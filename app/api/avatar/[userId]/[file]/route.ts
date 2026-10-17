import { type NextRequest, NextResponse } from "next/server";
import { avatarBucket, avatarKey } from "@/lib/avatar";

export const runtime = "nodejs";

/**
 * Serve a hosted profile photo. Every upload gets a new file name, so a file
 * never changes: browsers and the edge cache keep it for a year, and repeat
 * views cost no R2 read. Public, like the profile it belongs to.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string; file: string }> }) {
  const { userId, file } = await params;
  const key = avatarKey(`${userId}/${file}`);
  if (!key) return new NextResponse("Not found", { status: 404 });

  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const hit = await cache?.match(req.url);
  if (hit) return hit;

  const object = await avatarBucket().get(key);
  if (!object) return new NextResponse("Not found", { status: 404 });
  const res = new NextResponse(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
  await cache?.put(req.url, res.clone()).catch(() => {});
  return res;
}
