import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { writeClient } from "@/sanity/lib/writeClient";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/authz";
import { parseCompanySuggestion } from "@/lib/company-submission";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

// In-memory rate limit (per warm instance). Keyed by user id — submit is
// always authenticated, so this can't be bypassed by spoofing IPs or rotating
// addresses (only by creating many accounts). Cold starts reset the window,
// which is acceptable for this low-stakes endpoint. For a hard guarantee,
// swap this for Upstash Redis (Ratelimit.slidingWindow) keyed by the same id.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(key: string): boolean {
  const now = Date.now();
  // Opportunistic cleanup so the map can't grow unbounded across requests.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Auth is required — derive the user from the verified server session, never
  // from the request body (so a client cannot spoof someone else's userId or
  // submit anonymously).
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Rate limit per user (more robust than per-IP for an authed endpoint).
  if (rateLimited(user.id)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  let data: Record<string, string>;
  try {
    data = await req.json();
  } catch {
    return new NextResponse("Invalid body", { status: 400 });
  }

  // Honeypot: real users never fill this.
  if (data.company) return NextResponse.json({ ok: true });

  // Company suggestions have their own shape and approval path.
  if (data.kind === "company") {
    return submitCompany(data as Record<string, unknown>, user.id, user.email ?? "");
  }

  // Submission kinds: "new" (brand-new resource), "fix" (correct a broken URL),
  // "taxonomy" (correct a resource's categories/tags). Fixes target an
  // existing resource.
  const kind =
    data.kind === "fix" || data.kind === "taxonomy" ? data.kind : "new";
  const isFix = kind === "fix" || kind === "taxonomy";
  const targetResourceId = isFix ? (data.targetResourceId ?? "").trim() : "";
  if (isFix && !targetResourceId) {
    return new NextResponse("Missing target resource", { status: 400 });
  }

  const name = (data.name ?? "").trim();
  const url = (data.url ?? "").trim();
  // A URL is required everywhere except taxonomy fixes (which don't touch it).
  if (!name || (kind !== "taxonomy" && !isValidUrl(url))) {
    return new NextResponse("Name and a valid URL are required", {
      status: 400,
    });
  }

  // Identity comes from the session, not the body.
  const userId = user.id;
  const email = user.email ?? "";

  const PRICINGS = ["free", "freemium", "paid"];
  const pricing = PRICINGS.includes(data.pricing) ? data.pricing : undefined;
  // Tags arrive comma-separated; normalize to a clean, deduped, capped list.
  const tags = Array.from(
    new Set(
      String(data.tags ?? "")
        .split(",")
        .map((tg) => tg.trim().slice(0, 40))
        .filter(Boolean),
    ),
  ).slice(0, 10);

  // Proposed taxonomy (existing slugs or new free-text titles), capped/cleaned.
  const cleanList = (raw: unknown, cap: number) =>
    Array.from(
      new Set(
        (Array.isArray(raw) ? raw : [])
          .map((v) => String(v).trim().slice(0, 60))
          .filter(Boolean),
      ),
    ).slice(0, cap);
  const proposedCategories = cleanList(
    (data as Record<string, unknown>).proposedCategories,
    12,
  );
  const proposedTags = cleanList(
    (data as Record<string, unknown>).proposedTags,
    20,
  );
  // Proposed description (taxonomy fixes only): trimmed, capped, null when empty.
  const rawDescription = (data as Record<string, unknown>).proposedDescription;
  const proposedDescription =
    kind === "taxonomy" && typeof rawDescription === "string"
      ? rawDescription.trim().slice(0, 1000) || null
      : null;
  // A taxonomy suggestion must change SOMETHING — categories, tags, or the
  // description.
  if (
    kind === "taxonomy" &&
    !proposedCategories.length &&
    !proposedTags.length &&
    !proposedDescription
  ) {
    return new NextResponse("Propose at least one change", {
      status: 400,
    });
  }

  // For taxonomy fixes, snapshot the resource's CURRENT taxonomy + description
  // server-side (trusted source) so the suggestion view can highlight what's new.
  let originalCategories: string[] = [];
  let originalTags: string[] = [];
  let originalDescription: string | null = null;
  if (kind === "taxonomy") {
    const snap = await writeClient.fetch<{
      categories?: string[];
      tags?: string[];
      description?: string | null;
    } | null>(
      `*[_id == $id][0]{ "categories": categories[]->slug.current, "tags": tags[]->slug.current, description }`,
      { id: targetResourceId },
    );
    originalCategories = (snap?.categories ?? []).filter(Boolean);
    originalTags = (snap?.tags ?? []).filter(Boolean);
    originalDescription = snap?.description ?? null;
  }

  const fields = {
    name: name.slice(0, 200),
    url,
    suggestedCategory: (data.suggestedCategory ?? "").slice(0, 100),
    pricing,
    tags,
    note: (data.note ?? "").slice(0, 1000),
  };

  // Resubmit path: the user edited a previously rejected submission. We update
  // that same doc back to "pending" (clearing the rejection reason) instead of
  // creating a duplicate. Ownership is enforced against submittedBy.
  const resubmitId = (data.submissionId ?? "").trim();

  try {
    const db = getDb();

    if (resubmitId) {
      // Verify the doc belongs to this user and is rejected before touching it.
      const existing = await writeClient.fetch<{
        submittedBy?: string;
        status?: string;
      } | null>(`*[_id == $id][0]{submittedBy, status}`, { id: resubmitId });

      if (!existing || existing.submittedBy !== userId) {
        return new NextResponse("Not found", { status: 404 });
      }
      // Editing is allowed while a submission is still in the queue (pending)
      // or was rejected. Approved submissions are live and immutable here.
      if (existing.status !== "rejected" && existing.status !== "pending") {
        return new NextResponse("This submission can no longer be edited", {
          status: 409,
        });
      }

      await writeClient
        .patch(resubmitId)
        .set({ ...fields, status: "pending" })
        .unset(["rejectionReason"])
        .commit();

      await db
        .update(submissions)
        .set({
          name: fields.name,
          url: fields.url,
          suggestedCategory: fields.suggestedCategory,
          pricing: fields.pricing ?? null,
          tags: fields.tags,
          note: fields.note,
          status: "pending",
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(submissions.sanitySubmissionId, resubmitId),
            eq(submissions.userId, userId),
          ),
        );

      return NextResponse.json({ ok: true, resubmitted: true });
    }

    // One open taxonomy suggestion per resource per user — block duplicates
    // (the UI also hides the button, this is the server-side guard).
    if (kind === "taxonomy") {
      const dup = await writeClient.fetch<string | null>(
        `*[_type == "submission" && kind == "taxonomy" && submittedBy == $u && targetResourceId == $r && status == "pending"][0]._id`,
        { u: userId, r: targetResourceId },
      );
      if (dup) {
        return new NextResponse("You already have a pending suggestion", {
          status: 409,
        });
      }
    }

    const created = await writeClient.create({
      _type: "submission",
      ...fields,
      kind,
      ...(isFix ? { targetResourceId } : {}),
      ...(kind === "taxonomy"
        ? {
            proposedCategories,
            proposedTags,
            proposedDescription,
            originalCategories,
            originalTags,
            originalDescription,
          }
        : {}),
      email: email.slice(0, 200),
      submittedBy: userId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Mirror to D1 so the submission is tied to the user and shows up in
    // "My submissions". If this fails the two stores would diverge (Sanity doc
    // exists, user can't see/track it), so we roll back the Sanity doc and
    // report failure instead of silently succeeding.
    let mirrorError: unknown = null;
    try {
      await db.insert(submissions).values({
        userId,
        sanitySubmissionId: created._id,
        kind,
        targetResourceId: targetResourceId || null,
        name: fields.name,
        url: fields.url,
        suggestedCategory: fields.suggestedCategory,
        pricing: fields.pricing ?? null,
        tags: fields.tags,
        proposedCategories,
        proposedTags,
        proposedDescription,
        originalCategories,
        originalTags,
        originalDescription,
        note: fields.note,
        status: "pending",
      });
    } catch (err) {
      mirrorError = err;
    }

    if (mirrorError) {
      console.error("submission mirror failed", mirrorError);
      // Roll back the orphaned Sanity doc so the stores stay consistent.
      try {
        await writeClient.delete(created._id);
      } catch (rollbackErr) {
        console.error("submission rollback failed", rollbackErr);
      }
      return new NextResponse("Could not save submission", { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("submission failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}

/**
 * A suggested company → a pending `submission` (kind "company") for an editor
 * to review. On approval /api/notify creates the live company document. Exact
 * duplicates of an existing company (same slug) are rejected up front.
 */
async function submitCompany(data: Record<string, unknown>, userId: string, email: string) {
  const parsed = parseCompanySuggestion(data);
  if (!parsed.ok) return new NextResponse(parsed.error, { status: 400 });
  const c = parsed.value;
  const slug = slugify(c.name);
  if (!slug) return new NextResponse("Invalid name", { status: 400 });

  try {
    const [existing, pendingDup] = await Promise.all([
      writeClient.fetch<string | null>(
        `*[_type == "company" && slug.current == $slug][0].slug.current`,
        { slug },
      ),
      writeClient.fetch<string | null>(
        `*[_type == "submission" && kind == "company" && submittedBy == $u && status == "pending" && name == $name][0]._id`,
        { u: userId, name: c.name },
      ),
    ]);
    if (existing) {
      return NextResponse.json({ error: "exists", slug: existing }, { status: 409 });
    }
    if (pendingDup) {
      return NextResponse.json({ error: "pending" }, { status: 409 });
    }

    const url = c.website ?? c.careerUrl ?? c.linkedin ?? "";
    const created = await writeClient.create({
      _type: "submission",
      kind: "company",
      name: c.name,
      ...(url && { url }),
      ...(c.website && { companyWebsite: c.website }),
      ...(c.careerUrl && { companyCareerUrl: c.careerUrl }),
      ...(c.linkedin && { companyLinkedin: c.linkedin }),
      companyEmails: c.emails,
      companyCities: c.cities,
      companyOtherLocations: c.otherLocations,
      companyWorkModels: c.workModels,
      note: c.note,
      email: email.slice(0, 200),
      submittedBy: userId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    try {
      await getDb().insert(submissions).values({
        userId,
        sanitySubmissionId: created._id,
        kind: "company",
        name: c.name,
        url: url || null,
        note: c.note,
        status: "pending",
      });
    } catch (err) {
      // Keep the stores consistent (same policy as resource submissions).
      console.error("company submission mirror failed", err);
      await writeClient.delete(created._id).catch(() => {});
      return new NextResponse("Could not save submission", { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("company submission failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
