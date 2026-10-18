import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser, isVerified } from "@/lib/authz";
import { checkPdf, cvBucket } from "@/lib/cv-files";
import { parseCvMeta } from "@/lib/cv-input";
import { CV_MAX_BYTES } from "@/lib/cv-taxonomy";
import { getDb } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { dailyCap, dailyCapReached, isPaused, isRateLimited, overLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { inBackground, serverTiming } from "@/lib/server-timing";
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
  const timing = serverTiming();
  const user = await getSessionUser();
  timing.mark("session");
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!isVerified(user)) return NextResponse.json({ error: "unverified" }, { status: 403 });
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
  timing.mark("body");
  if (form.get("consent") !== "yes") return NextResponse.json({ error: "consent" }, { status: 400 });
  const meta = parseCvMeta(Object.fromEntries(form));
  if (!meta.ok) return NextResponse.json({ error: meta.error }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file" }, { status: 400 });
  if (file.size > CV_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPdf(bytes);
  if (check !== "ok") return NextResponse.json({ error: check }, { status: 400 });
  timing.mark("check");
  // Counted only for valid uploads, so a rejected file doesn't use up the day.
  // Independent steps run together.
  const db = getDb();
  const [userOver, siteOver, [existing]] = await Promise.all([
    isRateLimited(`cv-day:${user.id}`, UPLOADS_PER_DAY, 86400),
    dailyCapReached("cv-uploads", dailyCap("cvUploads")),
    db.select().from(cvs).where(eq(cvs.userId, user.id)).limit(1),
  ]);
  timing.mark("limits");
  if (userOver || siteOver) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const id = existing?.id ?? crypto.randomUUID();
  const fileKey = `cvs/${id}/${crypto.randomUUID()}.pdf`;
  const bucket = cvBucket();

  let submissionId: string | null = null;
  let stored = false;
  try {
    // The file and its review document are written at the same time; both
    // are awaited before deciding, so a failure never leaves the other behind.
    const [put, created] = await Promise.allSettled([
      bucket.put(fileKey, bytes, { httpMetadata: { contentType: "application/pdf" } }),
      writeClient.create(
        {
          _type: "submission",
          kind: "cv",
          name: `${meta.value.title} — @${user.username ?? user.id}`,
          cvId: id,
          // Opens only for the site's admins (ADMIN_EMAILS) — the dataset is public.
          cvFileUrl: `${req.nextUrl.origin}/api/cv/${id}/file`,
          cvField: meta.value.field,
          cvSeniority: meta.value.seniority,
          cvLanguage: meta.value.language,
          cvTechnologies: meta.value.technologies,
          note: meta.value.summary ?? undefined,
          submittedBy: user.id,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
        { visibility: "async" },
      ),
    ]);
    stored = put.status === "fulfilled";
    if (created.status === "fulfilled") submissionId = created.value._id;
    if (put.status === "rejected") throw put.reason;
    if (created.status === "rejected") throw created.reason;
    const submission = created.value;
    timing.mark("store");

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
    timing.mark("save");
  } catch (err) {
    // Nothing points at the new file or review document yet: remove both.
    console.error("cv upload failed", err);
    if (stored) await bucket.delete(fileKey).catch(() => {});
    if (submissionId) await writeClient.delete(submissionId).catch(() => {});
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  // The row now points at the new file. Cleaning up the old one happens after
  // the response and never undoes the upload.
  if (existing) {
    inBackground(bucket.delete(existing.fileKey));
    // A replaced CV leaves the review queue for good.
    if (existing.sanitySubmissionId && existing.status === "pending")
      inBackground(writeClient.delete(existing.sanitySubmissionId));
  }
  return NextResponse.json({ ok: true }, { headers: { "Server-Timing": timing.header() } });
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
