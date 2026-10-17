import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/authz";
import { checkPdf, cvBucket, reviewLink } from "@/lib/cv-files";
import { parseCvMeta } from "@/lib/cv-input";
import { CV_MAX_BYTES } from "@/lib/cv-taxonomy";
import { getDb } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { dailyCap, dailyCapReached, isPaused, isRateLimited, overLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { writeClient } from "@/sanity/lib/writeClient";

export const runtime = "nodejs";

/** Uploads per user per day — each one is an R2 write and a Sanity document. */
const UPLOADS_PER_DAY = 3;

/**
 * Upload (or replace) the signed-in user's CV: a PDF of at most 2 MB plus its
 * listing details. It goes to R2 and waits as a pending Sanity submission;
 * approving it there publishes it (/api/notify). Replacing a CV sends it back
 * to review. One CV per user, so storage per account is bounded.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (isPaused("UPLOADS_PAUSED")) return NextResponse.json({ error: "paused" }, { status: 503 });

  // Reject oversized bodies before reading them.
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > CV_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });

  if (await overLimit("RL_SUBMIT", `cv:${user.id}`))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (form.get("consent") !== "yes") return NextResponse.json({ error: "consent" }, { status: 400 });
  const meta = parseCvMeta(Object.fromEntries(form));
  if (!meta.ok) return NextResponse.json({ error: meta.error }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file" }, { status: 400 });
  if (file.size > CV_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPdf(bytes);
  if (check !== "ok") return NextResponse.json({ error: check }, { status: 400 });
  // Counted only for valid uploads, so a rejected file doesn't use up the day.
  if (await isRateLimited(`cv-day:${user.id}`, UPLOADS_PER_DAY, 86400))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (await dailyCapReached("cv-uploads", dailyCap("cvUploads")))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const db = getDb();
  const [existing] = await db.select().from(cvs).where(eq(cvs.userId, user.id)).limit(1);
  const id = existing?.id ?? crypto.randomUUID();
  const fileKey = `cvs/${id}/${crypto.randomUUID()}.pdf`;
  const bucket = cvBucket();
  await bucket.put(fileKey, bytes, { httpMetadata: { contentType: "application/pdf" } });

  let submissionId: string | null = null;
  try {
    const submission = await writeClient.create({
      _type: "submission",
      kind: "cv",
      name: `${meta.value.title} — @${user.username ?? user.id}`,
      cvId: id,
      cvFileUrl: reviewLink(req.nextUrl.origin, id),
      cvField: meta.value.field,
      cvSeniority: meta.value.seniority,
      cvLanguage: meta.value.language,
      cvTechnologies: meta.value.technologies,
      note: meta.value.summary ?? undefined,
      email: (user.email ?? "").slice(0, 200),
      submittedBy: user.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    submissionId = submission._id;

    const now = new Date();
    const row = {
      ...meta.value,
      fileKey,
      fileSize: bytes.byteLength,
      status: "pending",
      rejectionReason: null,
      sanitySubmissionId: submission._id,
      updatedAt: now,
    };
    if (existing) await db.update(cvs).set(row).where(eq(cvs.id, id));
    else await db.insert(cvs).values({ id, userId: user.id, ...row });
  } catch (err) {
    // Nothing points at the new file or review document yet: remove both.
    console.error("cv upload failed", err);
    await bucket.delete(fileKey).catch(() => {});
    if (submissionId) await writeClient.delete(submissionId).catch(() => {});
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  // The row now points at the new file. Cleaning up the old one is best effort
  // and must never undo the upload.
  if (existing) {
    await bucket.delete(existing.fileKey).catch((err) => console.error("old cv file delete failed", err));
    // A replaced CV leaves the review queue for good.
    if (existing.sanitySubmissionId && existing.status === "pending")
      await writeClient.delete(existing.sanitySubmissionId).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

/** Delete the signed-in user's CV: the file, its listing and its likes. */
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const db = getDb();
  const [cv] = await db.select().from(cvs).where(eq(cvs.userId, user.id)).limit(1);
  if (!cv) return NextResponse.json({ ok: true });
  await db.delete(cvs).where(eq(cvs.id, cv.id)); // cascades cv_likes
  await cvBucket().delete(cv.fileKey);
  if (cv.sanitySubmissionId && cv.status === "pending")
    await writeClient.delete(cv.sanitySubmissionId).catch(() => {});
  return NextResponse.json({ ok: true });
}
