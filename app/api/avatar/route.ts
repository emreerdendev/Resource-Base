import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { AVATAR_MAX_BYTES, avatarBucket, avatarUrl, deleteAvatarFile, sniffImage } from "@/lib/avatar";
import { getSessionUser } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { dailyCap, dailyCapReached, isPaused, isRateLimited, overLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/** Avatar changes per user per day — each one is an R2 write. */
const CHANGES_PER_DAY = 10;

async function currentImage(id: string) {
  const [row] = await getDb()
    .select({ image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);
  return row?.image ?? null;
}

/**
 * Upload a new profile photo: the raw body is the image, already cropped to a
 * square and resized to 256px in the browser (WebP, or JPEG where the browser
 * can't encode WebP). The type is checked from its bytes; the previous hosted
 * photo is removed.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const me = await getSessionUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });
  if (isPaused("UPLOADS_PAUSED")) return NextResponse.json({ error: "paused" }, { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > AVATAR_MAX_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (await overLimit("RL_USER", `avatar:${me.id}`))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > AVATAR_MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const ext = sniffImage(bytes);
  if (!ext) return NextResponse.json({ error: "not_image" }, { status: 400 });
  // Counted only for valid uploads, so a rejected file doesn't use up the day.
  if (await isRateLimited(`avatar-day:${me.id}`, CHANGES_PER_DAY, 86400))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (await dailyCapReached("avatars", dailyCap("avatars")))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const path = `${me.id}/${crypto.randomUUID()}.${ext}`;
  await avatarBucket().put(`avatars/${path}`, bytes, {
    httpMetadata: { contentType: ext === "webp" ? "image/webp" : "image/jpeg" },
  });
  const previous = await currentImage(me.id);
  const image = avatarUrl(path);
  await getDb().update(userTable).set({ image, updatedAt: new Date() }).where(eq(userTable.id, me.id));
  await deleteAvatarFile(previous);
  return NextResponse.json({ image });
}

/** Remove the profile photo (the initial is shown instead). */
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const me = await getSessionUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });
  if (await overLimit("RL_USER", `avatar:${me.id}`))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const previous = await currentImage(me.id);
  await getDb().update(userTable).set({ image: null, updatedAt: new Date() }).where(eq(userTable.id, me.id));
  await deleteAvatarFile(previous);
  return NextResponse.json({ image: null });
}
