import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { writeClient } from "@/sanity/lib/writeClient";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/authz";
import { parseCompanySuggestion } from "@/lib/company-submission";
import { normalizeWebUrl } from "@/lib/company-input";
import { slugify } from "@/lib/slug";
import { isRateLimited, overLimit } from "@/lib/rate-limit";
import { isPlainId, isResourceId, listCompanyIds } from "@/sanity/lib/slugs";
import { changedFields, parseCompanyEdit, type CompanyEditFields } from "@/lib/company-edit";
import { isSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/** Submissions create Sanity documents, so they're capped three ways. */
const MAX_PER_DAY = 20;
const MAX_PENDING = 20;

/** Body fields arrive untyped — anything that isn't a string reads as "". */
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Burst limit (free binding, per minute), daily cap (KV, only touched by real
 * submissions) and a ceiling on open submissions in the review queue — so one
 * account can't fill the Sanity dataset or the moderation queue.
 */
async function submitLimited(userId: string): Promise<boolean> {
  if (await overLimit("RL_SUBMIT", `submit:${userId}`)) return true;
  const [{ open }] = await getDb()
    .select({ open: count() })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.status, "pending")));
  if (open >= MAX_PENDING) return true;
  return isRateLimited(`submit-day:${userId}`, MAX_PER_DAY, 86400);
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
  if (!isSameOrigin(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Auth is required — derive the user from the verified server session, never
  // from the request body (so a client cannot spoof someone else's userId or
  // submit anonymously).
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return new NextResponse("Invalid body", { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return new NextResponse("Invalid body", { status: 400 });
  }

  // Honeypot: real users never fill this.
  if (data.company) return NextResponse.json({ ok: true });

  // Rate limit per user (more robust than per-IP for an authed endpoint).
  if (await submitLimited(user.id)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  // Company suggestions and company edits have their own shape and approval path.
  if (data.kind === "companyEdit") {
    return submitCompanyEdit(data, user.id, user.email ?? "");
  }
  if (data.kind === "company") {
    return submitCompany(data, user.id, user.email ?? "");
  }

  // Submission kinds: "new" (brand-new resource), "fix" (correct a broken URL),
  // "taxonomy" (correct a resource's categories/tags). Fixes target an
  // existing resource.
  const kind =
    data.kind === "fix" || data.kind === "taxonomy" ? data.kind : "new";
  const isFix = kind === "fix" || kind === "taxonomy";
  const targetResourceId = isFix ? str(data.targetResourceId) : "";
  // Fixes may only target a published resource — never a draft or any other
  // document type (the id is used to read and, on approval, patch the doc).
  if (isFix && !(await isResourceId(targetResourceId))) {
    return new NextResponse("Unknown target resource", { status: 400 });
  }

  const name = str(data.name);
  const url = str(data.url);
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
  const pricing = PRICINGS.includes(str(data.pricing)) ? str(data.pricing) : undefined;
  // Tags arrive comma-separated; normalize to a clean, deduped, capped list.
  const tags = Array.from(
    new Set(
      str(data.tags)
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
          .map((v) => str(v).slice(0, 60))
          .filter(Boolean),
      ),
    ).slice(0, cap);
  // "Gone / should be removed" replaces every other proposed change.
  const proposeRemoval = kind === "taxonomy" && data.proposeRemoval === true;
  const proposedCategories = proposeRemoval ? [] : cleanList(data.proposedCategories, 12);
  const proposedTags = proposeRemoval ? [] : cleanList(data.proposedTags, 20);
  // Proposed description (edit suggestions only): trimmed, capped, null when empty.
  const rawDescription = data.proposedDescription;
  const proposedDescription =
    kind === "taxonomy" && !proposeRemoval && typeof rawDescription === "string"
      ? rawDescription.trim().slice(0, 1000) || null
      : null;
  // Proposed name / link — the link must be a real http(s) address.
  const proposedName =
    kind === "taxonomy" && !proposeRemoval ? str(data.proposedName).slice(0, 200) || null : null;
  const rawProposedUrl = kind === "taxonomy" && !proposeRemoval ? str(data.proposedUrl) : "";
  const proposedUrl = rawProposedUrl ? normalizeWebUrl(rawProposedUrl) : null;
  if (rawProposedUrl && !proposedUrl) {
    return new NextResponse("Invalid proposed link", { status: 400 });
  }
  if (proposedName !== null && proposedName.length < 2) {
    return new NextResponse("Invalid proposed name", { status: 400 });
  }
  // An edit suggestion must propose SOMETHING.
  if (
    kind === "taxonomy" &&
    !proposeRemoval &&
    !proposedName &&
    !proposedUrl &&
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
  // The resource's current name/link, read here rather than trusted from the body.
  let currentName = name;
  let currentUrl = url;
  if (kind === "taxonomy") {
    const snap = await writeClient.fetch<{
      name?: string;
      url?: string;
      categories?: string[];
      tags?: string[];
      description?: string | null;
    } | null>(
      `*[_type == "resource" && _id == $id][0]{ name, url, "categories": categories[]->slug.current, "tags": tags[]->slug.current, description }`,
      { id: targetResourceId },
      { perspective: "published" },
    );
    originalCategories = (snap?.categories ?? []).filter(Boolean);
    originalTags = (snap?.tags ?? []).filter(Boolean);
    originalDescription = snap?.description ?? null;
    currentName = snap?.name ?? name;
    currentUrl = snap?.url ?? url;
  }

  const fields = {
    name: currentName.slice(0, 200),
    url: currentUrl,
    suggestedCategory: str(data.suggestedCategory).slice(0, 100),
    pricing,
    tags,
    note: str(data.note).slice(0, 1000),
  };

  // Resubmit path: the user edited a previously rejected submission. We update
  // that same doc back to "pending" (clearing the rejection reason) instead of
  // creating a duplicate. Ownership is enforced against submittedBy.
  const resubmitId = str(data.submissionId);
  if (resubmitId && !isPlainId(resubmitId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const db = getDb();

    if (resubmitId) {
      // Verify the doc belongs to this user and is rejected before touching it.
      const existing = await writeClient.fetch<{
        submittedBy?: string;
        status?: string;
      } | null>(`*[_type == "submission" && _id == $id][0]{submittedBy, status}`, {
        id: resubmitId,
      });

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
            ...(proposedName && proposedName !== currentName && { proposedName }),
            ...(proposedUrl && proposedUrl !== currentUrl && { proposedUrl }),
            ...(proposeRemoval && { proposeRemoval: true }),
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
        proposedName: proposedName && proposedName !== currentName ? proposedName : null,
        proposedUrl: proposedUrl && proposedUrl !== currentUrl ? proposedUrl : null,
        proposeRemoval,
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

/**
 * A suggested correction to a published company (or a report that it should
 * be removed) → a pending `submission` (kind "companyEdit"). Only fields that
 * differ from the live company are kept; /api/notify applies them on approval.
 */
async function submitCompanyEdit(data: Record<string, unknown>, userId: string, email: string) {
  const companyId = str(data.targetCompanyId);
  if (!(await listCompanyIds()).has(companyId)) {
    return new NextResponse("Unknown company", { status: 400 });
  }
  const current = await writeClient.fetch<{
    name?: string;
    website?: string;
    careerLinks?: string[];
    linkedin?: string;
    emails?: string[];
  } | null>(
    `*[_type == "company" && _id == $id][0]{ name, website, careerLinks, linkedin, emails }`,
    { id: companyId },
    { perspective: "published" },
  );
  if (!current?.name) return new NextResponse("Unknown company", { status: 400 });
  const original = {
    name: current.name,
    website: current.website ?? "",
    careerUrl: current.careerLinks?.[0] ?? "",
    linkedin: current.linkedin ?? "",
    emails: current.emails ?? [],
  };

  const removal = data.proposeRemoval === true;
  let changes: CompanyEditFields = {};
  if (!removal) {
    const parsed = parseCompanyEdit(data);
    if (!parsed.ok) return new NextResponse(`Invalid ${parsed.error}`, { status: 400 });
    changes = changedFields(original, parsed.value);
    if (!Object.keys(changes).length) {
      return new NextResponse("Propose at least one change", { status: 400 });
    }
  }
  const note = str(data.note).slice(0, 1000);

  try {
    const dup = await writeClient.fetch<string | null>(
      `*[_type == "submission" && kind == "companyEdit" && submittedBy == $u && targetResourceId == $r && status == "pending"][0]._id`,
      { u: userId, r: companyId },
    );
    if (dup) return NextResponse.json({ error: "pending" }, { status: 409 });

    const cleared = (["website", "careerUrl", "linkedin", "emails"] as const).filter((k) =>
      k === "emails" ? changes.emails?.length === 0 : changes[k] === "",
    );
    const created = await writeClient.create({
      _type: "submission",
      kind: "companyEdit",
      name: original.name,
      ...(original.website && { url: original.website }),
      targetResourceId: companyId,
      ...(removal && { proposeRemoval: true }),
      ...(changes.name && { proposedName: changes.name }),
      ...(changes.website && { companyWebsite: changes.website }),
      ...(changes.careerUrl && { companyCareerUrl: changes.careerUrl }),
      ...(changes.linkedin && { companyLinkedin: changes.linkedin }),
      ...(changes.emails?.length && { companyEmails: changes.emails }),
      ...(cleared.length && { clearFields: cleared }),
      note,
      email: email.slice(0, 200),
      submittedBy: userId,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    try {
      await getDb().insert(submissions).values({
        userId,
        sanitySubmissionId: created._id,
        kind: "companyEdit",
        targetResourceId: companyId,
        name: original.name,
        url: original.website || null,
        proposeRemoval: removal,
        proposedName: changes.name ?? null,
        proposedFields: removal ? null : changes,
        originalFields: original,
        note,
        status: "pending",
      });
    } catch (err) {
      console.error("company edit mirror failed", err);
      await writeClient.delete(created._id).catch(() => {});
      return new NextResponse("Could not save submission", { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("company edit failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
