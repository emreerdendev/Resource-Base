import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cvs, notifications, submissions } from "@/lib/db/schema";
import { writeClient } from "@/sanity/lib/writeClient";
import { slugify } from "@/lib/slug";
import { isPlainId } from "@/sanity/lib/slugs";
import { isFreshWebhook } from "@/lib/webhook-age";
import { inBackground } from "@/lib/server-timing";
import { sendApprovalEmails } from "@/lib/approval-emails";

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
async function createCompanyFromSubmission(
  submissionId: string,
  submittedBy: string,
): Promise<string | null> {
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
    // Credits the suggester ("Added by @username", resolved live by id).
    submittedBy,
    internalNotes: `Suggested by the community (submission ${submissionId}).`,
  });
  return slug;
}

/**
 * Publish the resource from an approved "new" suggestion. Reads the submission
 * itself (editors may adjust it before approving). The id is derived from the
 * submission, so a retried webhook never creates it twice; the slug gets a
 * numeric suffix if another resource already uses it. The suggested category
 * and tags are matched to existing ones; anything unmatched is noted on the
 * submission for the editor. Returns the resource slug.
 */
async function createResourceFromSubmission(submissionId: string, submittedBy: string): Promise<string | null> {
  const doc = await writeClient.fetch<{
    name?: string;
    url?: string;
    suggestedCategory?: string;
    pricing?: string;
    tags?: string[];
  } | null>(
    `*[_type == "submission" && _id == $id][0]{ name, url, suggestedCategory, pricing, tags }`,
    { id: submissionId },
  );
  const name = doc?.name?.trim().slice(0, 200);
  const base = name ? slugify(name) : "";
  if (!doc?.url || !name || !base) return null;

  const id = `resource-${submissionId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const existing = await writeClient.fetch<{ slug?: string } | null>(
    `*[_id == $id][0]{ "slug": slug.current }`,
    { id },
  );
  if (existing?.slug) return existing.slug; // already created by an earlier delivery

  const taken = new Set(
    await writeClient.fetch<string[]>(
      `*[_type == "resource" && slug.current match $prefix].slug.current`,
      { prefix: `${base}*` },
    ),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const [cats, tags] = await Promise.all([
    resolveRefs("category", doc.suggestedCategory ? [doc.suggestedCategory] : []),
    resolveRefs("tag", doc.tags ?? []),
  ]);
  await writeClient.createIfNotExists({
    _id: id,
    _type: "resource",
    name,
    slug: { _type: "slug", current: slug },
    url: doc.url,
    categories: cats.refs,
    tags: tags.refs,
    ...(doc.pricing && ["free", "freemium", "paid"].includes(doc.pricing) && { pricing: doc.pricing }),
    featured: false,
    linkStatus: "unchecked",
    submissionStatus: "published",
    addedAt: new Date().toISOString(),
    // Credits the suggester ("Added by @username", resolved live by id).
    submittedBy,
    internalNotes: `Suggested by the community (submission ${submissionId}).`,
  });
  const unresolved = [...cats.unresolved, ...tags.unresolved];
  if (unresolved.length) {
    await writeClient
      .patch(submissionId)
      .set({ note: `Created without these unmatched values — add them by hand: ${unresolved.join(", ")}` })
      .commit()
      .catch(() => {});
  }
  return slug;
}

/**
 * Apply an approved company edit. The proposal is read from the submission
 * (editors may adjust it before approving). Set fields replace the live ones,
 * `clearFields` empties them, and a removal hides the company (undo by setting
 * it back to Published in the Studio).
 */
async function applyCompanyEdit(submissionId: string, companyId: string, removal: boolean) {
  if (removal) {
    await writeClient.patch(companyId).set({ status: "hidden" }).commit();
    return;
  }
  const [doc, live] = await Promise.all([
    writeClient.fetch<(CompanySubmissionDoc & { proposedName?: string; clearFields?: string[] }) | null>(
      `*[_type == "submission" && _id == $id][0]{ proposedName, companyWebsite, companyCareerUrl, companyLinkedin, companyEmails, clearFields }`,
      { id: submissionId },
    ),
    writeClient.fetch<{ careerLinks?: string[]; linkedin?: string; emails?: string[] } | null>(
      `*[_type == "company" && _id == $id][0]{ careerLinks, linkedin, emails }`,
      { id: companyId },
    ),
  ]);
  if (!doc || !live) return;
  const clear = new Set(doc.clearFields ?? []);
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  const name = doc.proposedName?.trim();
  if (name) set.name = name.slice(0, 200);
  if (doc.companyWebsite) set.website = doc.companyWebsite;
  else if (clear.has("website")) unset.push("website");
  // The first career link is the one shown and edited; keep any others.
  let careerLinks = live.careerLinks ?? [];
  if (doc.companyCareerUrl) careerLinks = [doc.companyCareerUrl, ...careerLinks.slice(1)];
  else if (clear.has("careerUrl")) careerLinks = careerLinks.slice(1);
  set.careerLinks = careerLinks;
  let linkedin = live.linkedin;
  if (doc.companyLinkedin) set.linkedin = linkedin = doc.companyLinkedin;
  else if (clear.has("linkedin")) {
    unset.push("linkedin");
    linkedin = undefined;
  }
  let emails = live.emails ?? [];
  if (doc.companyEmails?.length) emails = doc.companyEmails;
  else if (clear.has("emails")) emails = [];
  set.emails = emails;
  // How to apply follows from what's left.
  set.channels = [emails.length && "email", careerLinks.length && "career", linkedin && "linkedin"].filter(Boolean);
  let patch = writeClient.patch(companyId).set(set);
  if (unset.length) patch = patch.unset(unset);
  await patch.commit();
}

/**
 * Sanity webhook → applies a moderation decision, notifies the submitter and
 * syncs their "My Submissions" row. On approval: a new resource or company is
 * published, a fix / edit suggestion / company edit is applied (or the item
 * hidden for a removal report), a CV is listed. If applying fails the route
 * returns 500 so Sanity retries, and nothing is announced.
 *
 * Configure in sanity.io/manage: filter
 *   _type == "submission" && status in ["approved", "rejected"] && delta::changedAny(status)
 * projection
 *   { _id, status, submittedBy, name, url, rejectionReason, kind, targetResourceId }
 * drafts off, secret SANITY_NOTIFY_SECRET.
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
  if (!isFreshWebhook(req)) {
    return new NextResponse("Stale webhook", { status: 401 });
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
  const isCompanyEdit = body.kind === "companyEdit";
  const isCv = body.kind === "cv";
  const isNew = !body.kind || body.kind === "new";
  const label = body.name ? `“${body.name}”` : "Your submission";

  // A CV decision publishes or rejects the listing it was made for. A review
  // of a CV that was since replaced or deleted is stale: nothing to apply.
  let cvTitle: string | null = null;
  if (isCv) {
    const [cv] = await db
      .select({ id: cvs.id, title: cvs.title })
      .from(cvs)
      .where(eq(cvs.sanitySubmissionId, body._id))
      .limit(1);
    if (!cv) return NextResponse.json({ skipped: "stale cv review" });
    cvTitle = cv.title;
    const now = new Date();
    await db
      .update(cvs)
      .set(
        approved
          ? { status: "published", publishedAt: now, rejectionReason: null, updatedAt: now }
          : { status: "rejected", rejectionReason: body.rejectionReason?.slice(0, 500) ?? null, updatedAt: now },
      )
      .where(eq(cvs.id, cv.id));
  }

  // On approval of a company suggestion, publish the company.
  let companySlug: string | null = null;
  if (approved && isCompany) {
    try {
      companySlug = await createCompanyFromSubmission(body._id, body.submittedBy);
    } catch (err) {
      console.error("company create failed", err);
    }
    // Not created → fail so Sanity retries, instead of telling the user their
    // company is live when it isn't.
    if (!companySlug) return new NextResponse("Company not created", { status: 500 });
  }

  // On approval of a new resource, publish it.
  let resourceSlug: string | null = null;
  if (approved && isNew) {
    try {
      resourceSlug = await createResourceFromSubmission(body._id, body.submittedBy);
    } catch (err) {
      console.error("resource create failed", err);
    }
    // Not created → fail so Sanity retries, instead of telling the user their
    // resource is live when it isn't.
    if (!resourceSlug) return new NextResponse("Resource not created", { status: 500 });
  }

  // An approved fix whose resource or company is gone has nothing to apply;
  // record the decision without telling the user it was applied.
  const editTargetGone =
    approved &&
    ((isFix && !targetResourceId) ||
      (isCompanyEdit &&
        !(body.targetResourceId && isPlainId(body.targetResourceId) &&
          (await writeClient.fetch<string | null>(`*[_type == "company" && _id == $id][0]._id`, {
            id: body.targetResourceId,
          })))));
  if (editTargetGone) {
    await db
      .update(submissions)
      .set({ status: body.status, rejectionReason: null, updatedAt: new Date() })
      .where(eq(submissions.sanitySubmissionId, body._id));
    return NextResponse.json({ skipped: "target gone" });
  }

  // On approval of a URL fix, apply the corrected url to the live resource and
  // reset its link health so the daily checker re-verifies it. A failure
  // returns 500 so Sanity retries, rather than notifying "applied".
  if (approved && isUrlFix && targetResourceId && body.url) {
    try {
      await writeClient
        .patch(targetResourceId)
        .set({ url: body.url, linkStatus: "unchecked" })
        .commit();
    } catch (err) {
      console.error("fix apply failed", err);
      return new NextResponse("Fix not applied", { status: 500 });
    }
  }

  // On approval of an edit suggestion, apply it to the resource. The proposal
  // is read from the submission itself (editors may have adjusted it before
  // approving, and the webhook projection doesn't carry every field).
  // Categories/tags resolve to references; free-text values that match no doc
  // are noted back on the submission for the editor.
  let removal = false;
  if (isTaxonomyFix || isCompanyEdit) {
    const flag = await writeClient.fetch<boolean | null>(
      `*[_type == "submission" && _id == $id][0].proposeRemoval`,
      { id: body._id },
    );
    removal = flag === true;
  }
  if (approved && isTaxonomyFix && targetResourceId) {
    try {
      const proposal = await writeClient.fetch<{
        proposedCategories?: string[];
        proposedTags?: string[];
        proposedDescription?: string;
        proposedName?: string;
        proposedUrl?: string;
      } | null>(
        `*[_type == "submission" && _id == $id][0]{ proposedCategories, proposedTags, proposedDescription, proposedName, proposedUrl }`,
        { id: body._id },
      );
      if (removal) {
        // Hidden, not deleted: set it back to Published in the Studio to undo.
        await writeClient.patch(targetResourceId).set({ submissionStatus: "removed" }).commit();
      } else {
        const [cats, tags] = await Promise.all([
          resolveRefs("category", proposal?.proposedCategories ?? []),
          resolveRefs("tag", proposal?.proposedTags ?? []),
        ]);
        const patch: Record<string, unknown> = {};
        if (cats.refs.length) patch.categories = cats.refs;
        if (tags.refs.length) patch.tags = tags.refs;
        // Text proposals are applied verbatim (they were reviewed before approval).
        const description = proposal?.proposedDescription?.trim();
        if (description) patch.description = description;
        const newName = proposal?.proposedName?.trim();
        if (newName) patch.name = newName.slice(0, 200);
        if (proposal?.proposedUrl) {
          patch.url = proposal.proposedUrl;
          patch.linkStatus = "unchecked"; // the daily checker re-verifies it
        }
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
      }
    } catch (err) {
      console.error("edit suggestion apply failed", err);
      return new NextResponse("Edit not applied", { status: 500 });
    }
  }

  // Company edits may only patch a published company document.
  let companyEditSlug: string | null = null;
  if (approved && isCompanyEdit && body.targetResourceId && isPlainId(body.targetResourceId)) {
    const target = await writeClient.fetch<{ slug?: string } | null>(
      `*[_type == "company" && _id == $id][0]{ "slug": slug.current }`,
      { id: body.targetResourceId },
    );
    if (target) {
      try {
        await applyCompanyEdit(body._id, body.targetResourceId, removal);
        companyEditSlug = removal ? null : (target.slug ?? null);
      } catch (err) {
        console.error("company edit apply failed", err);
        return new NextResponse("Company edit not applied", { status: 500 });
      }
    }
  }

  // Idempotent: source_key has a unique index, so webhook retries are no-ops.
  // The status is part of the key so an approve-after-reject still notifies.
  // `data` lets the UI render the message in the reader's language; title and
  // body keep an English fallback.
  const kind = isCv
    ? "cv"
    : isCompanyEdit
      ? removal
        ? "removal"
        : "companyEdit"
    : isCompany
      ? "company"
      : isUrlFix
        ? "fix"
        : removal
          ? "removal"
          : isTaxonomyFix
            ? "taxonomy"
            : "new";
  const resubmitHint = isCv
    ? "You can upload an updated CV."
    : isCompany
      ? "You can suggest it again with more details."
      : "You can edit and resubmit it.";
  const name = cvTitle ?? body.name;
  try {
    await db.insert(notifications).values({
      userId: body.submittedBy,
      type: approved ? "submission_approved" : "submission_rejected",
      title: approved
        ? isFix || (isCompanyEdit && !removal)
          ? "Your fix was applied ✅"
          : isCompanyEdit
            ? "Your report was confirmed ✅"
          : isCv
            ? "Your CV is now listed 🎉"
            : isCompany
              ? "Your company suggestion was approved 🎉"
              : "Your resource was approved 🎉"
        : "Your submission needs changes",
      body: approved
        ? isUrlFix
          ? `Thanks! ${label} now points to the corrected link.`
          : removal
            ? `Thanks! ${label} was removed from the directory.`
            : isTaxonomyFix || isCompanyEdit
            ? `Thanks! Your suggested changes to ${label} were applied.`
            : isCv
              ? `“${name}” is now in the CV directory.`
              : isCompany
                ? `${label} is now in the company directory.`
                : `${label} is now live in the directory.`
        : body.rejectionReason
          ? `${label} wasn’t approved: ${body.rejectionReason}`
          : `${label} wasn’t approved. ${resubmitHint}`,
      data: {
        kind,
        ...(name && { name: name.slice(0, 200) }),
        ...(!approved && body.rejectionReason && { reason: body.rejectionReason.slice(0, 500) }),
      },
      url: isCv
        ? "/profile/edit?tab=cv"
        : approved && isUrlFix
          ? (body.url ?? null)
          : approved && (companySlug || companyEditSlug)
            ? `/company/${companySlug ?? companyEditSlug}`
            : approved && resourceSlug
              ? `/resource/${resourceSlug}`
            : approved
              ? null
              : "/submissions",
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

  // A new resource or company went live: email the contributor too, once,
  // after the response (skipped if the daily or per-address limit is hit).
  if (approved && (kind === "new" || kind === "company")) inBackground(sendApprovalEmails({ sanityId: body._id }));

  return NextResponse.json({ ok: true });
}
