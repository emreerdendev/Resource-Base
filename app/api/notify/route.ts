import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, submissions } from "@/lib/db/schema";
import { writeClient } from "@/sanity/lib/writeClient";
import { slugify } from "@/lib/slug";
import { isPlainId } from "@/sanity/lib/slugs";

export const runtime = "nodejs";

type ModerationBody = {
  _id: string;
  status: string;
  submittedBy?: string;
  name?: string;
  url?: string;
  rejectionReason?: string;
  kind?: string;
  targetResourceId?: string;
  proposedCategories?: string[];
  proposedTags?: string[];
  proposedDescription?: string;
};

/**
 * Resolve proposed category/tag values (each an existing slug/title or new
 * free-text) to Sanity reference ids. Returns the matched references plus the
 * values that couldn't be resolved (so the editor can add them by hand).
 */
async function resolveRefs(
  docType: "category" | "tag",
  values: string[],
): Promise<{ refs: { _type: "reference"; _ref: string; _key: string }[]; unresolved: string[] }> {
  const refs: { _type: "reference"; _ref: string; _key: string }[] = [];
  const unresolved: string[] = [];
  const wanted = values.map((v) => v.trim()).filter(Boolean);
  if (!wanted.length) return { refs, unresolved };
  // One query for all values instead of one per value.
  const docs = await writeClient.fetch<{ _id: string; slug?: string; title?: string }[]>(
    `*[_type == $t && !(_id in path("drafts.**")) && (slug.current in $vs || lower(title) in $lower)]{ _id, "slug": slug.current, title }`,
    { t: docType, vs: wanted, lower: wanted.map((v) => v.toLowerCase()) },
  );
  for (const v of wanted) {
    const id = docs.find((d) => d.slug === v || d.title?.toLowerCase() === v.toLowerCase())?._id;
    if (id) {
      // Stable key derived from the ref id keeps the array idempotent.
      refs.push({ _type: "reference", _ref: id, _key: id.slice(0, 12) });
    } else {
      unresolved.push(v);
    }
  }
  return { refs, unresolved };
}

type CompanySubmissionDoc = {
  name?: string;
  companyWebsite?: string;
  companyCareerUrl?: string;
  companyLinkedin?: string;
  companyEmails?: string[];
  companyCities?: string[];
  companyOtherLocations?: string[];
  companyWorkModels?: string[];
};

/**
 * Create the live company from an approved suggestion. Reads the submission
 * itself (so the webhook projection doesn't need the company fields) and uses
 * the deterministic `company-<slug>` id, so retries never duplicate it.
 * Returns the company slug.
 */
async function createCompanyFromSubmission(submissionId: string): Promise<string | null> {
  const doc = await writeClient.fetch<CompanySubmissionDoc | null>(
    `*[_type == "submission" && _id == $id][0]{ name, companyWebsite, companyCareerUrl, companyLinkedin, companyEmails, companyCities, companyOtherLocations, companyWorkModels }`,
    { id: submissionId },
  );
  const name = doc?.name?.trim();
  const slug = name ? slugify(name) : "";
  if (!doc || !name || !slug) return null;

  const emails = doc.companyEmails ?? [];
  const careerLinks = doc.companyCareerUrl ? [doc.companyCareerUrl] : [];
  const channels = [
    emails.length && "email",
    careerLinks.length && "career",
    doc.companyLinkedin && "linkedin",
  ].filter(Boolean);

  await writeClient.createIfNotExists({
    _id: `company-${slug}`,
    _type: "company",
    name,
    slug: { _type: "slug", current: slug },
    ...(doc.companyWebsite && { website: doc.companyWebsite }),
    ...(doc.companyLinkedin && { linkedin: doc.companyLinkedin }),
    emails,
    careerLinks,
    channels,
    cities: doc.companyCities ?? [],
    otherLocations: doc.companyOtherLocations ?? [],
    workModels: doc.companyWorkModels ?? [],
    sectors: [],
    clients: [],
    status: "published",
    addedAt: new Date().toISOString(),
    internalNotes: `Suggested by the community (submission ${submissionId}).`,
  });
  return slug;
}

/**
 * Sanity webhook → D1 notification + mirror sync (+ fix apply).
 * Configure a webhook in sanity.io/manage filtered to
 *   _type == "submission" && (status == "approved" || status == "rejected")
 * projecting { _id, status, submittedBy, name, url, rejectionReason, kind,
 * targetResourceId, proposedCategories, proposedTags }, POSTing here with
 * SANITY_NOTIFY_SECRET. On approval of a "fix" the resource's url is updated
 * (and link status reset); on a "taxonomy" fix its categories/tags are set
 * from the resolved references. The submitter is notified and their "My
 * submissions" view
 * reflects the decision either way.
 */
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = await parseBody<ModerationBody>(
      req,
      process.env.SANITY_NOTIFY_SECRET,
    );
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const { isValidSignature, body } = parsed;
  if (!isValidSignature) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  if (!body || (body.status !== "approved" && body.status !== "rejected")) {
    // Not a moderation decision — ack so Sanity doesn't retry.
    return NextResponse.json({ skipped: true });
  }
  if (!body.submittedBy) {
    // Anonymous submission — no one to notify.
    return NextResponse.json({ skipped: "no user" });
  }

  const db = getDb();
  const sourceKey = `submission_${body.status}:${body._id}`;

  // A decision is applied once. Retries and replays of an already-handled
  // webhook stop here, so they can't re-apply a fix over later edits.
  const [handled] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.sourceKey, sourceKey))
    .limit(1);
  if (handled) return NextResponse.json({ ok: true, duplicate: true });

  // Fixes may only ever patch a published resource document.
  const targetResourceId =
    body.targetResourceId && isPlainId(body.targetResourceId) &&
    (await writeClient.fetch<string | null>(
      `*[_type == "resource" && _id == $id][0]._id`,
      { id: body.targetResourceId },
    ))
      ? body.targetResourceId
      : null;

  const approved = body.status === "approved";
  const isUrlFix = body.kind === "fix";
  const isTaxonomyFix = body.kind === "taxonomy";
  const isFix = isUrlFix || isTaxonomyFix;
  const isCompany = body.kind === "company";
  const label = body.name ? `“${body.name}”` : "Your submitted resource";

  // On approval of a company suggestion, publish the company.
  let companySlug: string | null = null;
  if (approved && isCompany) {
    try {
      companySlug = await createCompanyFromSubmission(body._id);
    } catch (err) {
      console.error("company create failed", err);
    }
    // Not created → fail so Sanity retries, instead of telling the user their
    // company is live when it isn't.
    if (!companySlug) return new NextResponse("Company not created", { status: 500 });
  }

  // On approval of a URL fix, apply the corrected url to the live resource and
  // reset its link health so the daily checker re-verifies it.
  if (approved && isUrlFix && targetResourceId && body.url) {
    try {
      await writeClient
        .patch(targetResourceId)
        .set({ url: body.url, linkStatus: "unchecked" })
        .commit();
    } catch (err) {
      console.error("fix apply failed", err);
    }
  }

  // On approval of a taxonomy fix, resolve the proposed categories/tags to
  // references and set them on the resource. Free-text values that don't match
  // an existing doc are recorded back on the submission for the editor.
  if (approved && isTaxonomyFix && targetResourceId) {
    try {
      const [cats, tags] = await Promise.all([
        resolveRefs("category", body.proposedCategories ?? []),
        resolveRefs("tag", body.proposedTags ?? []),
      ]);
      const patch: Record<string, unknown> = {};
      if (cats.refs.length) patch.categories = cats.refs;
      if (tags.refs.length) patch.tags = tags.refs;
      // Apply a proposed description verbatim (it was reviewed before approval).
      const proposedDescription = body.proposedDescription?.trim();
      if (proposedDescription) patch.description = proposedDescription;
      if (Object.keys(patch).length) {
        await writeClient.patch(targetResourceId).set(patch).commit();
      }
      const unresolved = [...cats.unresolved, ...tags.unresolved];
      if (unresolved.length) {
        await writeClient
          .patch(body._id)
          .set({
            note: `Unresolved proposals to add manually: ${unresolved.join(", ")}`,
          })
          .commit();
      }
    } catch (err) {
      console.error("taxonomy fix apply failed", err);
    }
  }

  // Idempotent: source_key has a unique index, so webhook retries are no-ops.
  // The status is part of the key so an approve-after-reject still notifies.
  try {
    await db.insert(notifications).values({
      userId: body.submittedBy,
      type: approved ? "submission_approved" : "submission_rejected",
      title: approved
        ? isFix
          ? "Your fix was applied ✅"
          : isCompany
            ? "Your company suggestion was approved 🎉"
            : "Your resource was approved 🎉"
        : "Your submission needs changes",
      body: approved
        ? isUrlFix
          ? `Thanks! ${label} now points to the corrected link.`
          : isTaxonomyFix
            ? `Thanks! The categories/tags for ${label} were updated.`
            : isCompany
              ? `${label} is now in the company directory.`
              : `${label} is now live in the directory.`
        : body.rejectionReason
          ? `${label} wasn’t approved: ${body.rejectionReason}`
          : `${label} wasn’t approved. You can edit and resubmit it.`,
      url:
        approved && isUrlFix
          ? (body.url ?? null)
          : approved && companySlug
            ? `/company/${companySlug}`
            : approved
              ? null
              : "/profile/edit",
      sourceKey,
    });
  } catch (error) {
    // Unique-violation on source_key means we already notified — treat as ok.
    if (!String(error).includes("UNIQUE")) {
      console.error("notify insert failed", error);
      return new NextResponse("Server error", { status: 500 });
    }
  }

  // Sync the mirror row so "My submissions" reflects the decision.
  await db
    .update(submissions)
    .set({
      status: body.status,
      rejectionReason: approved ? null : (body.rejectionReason ?? null),
      updatedAt: new Date(),
    })
    .where(eq(submissions.sanitySubmissionId, body._id));

  return NextResponse.json({ ok: true });
}
