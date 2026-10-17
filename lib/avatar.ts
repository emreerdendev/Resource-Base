import "server-only";

import { cvBucket } from "@/lib/cv-files";

/** Uploaded avatars are tiny (256×256, resized in the browser). */
export const AVATAR_MAX_BYTES = 200 * 1024;
const PUBLIC_PREFIX = "/api/avatar/";
const FILE_RE = /^[A-Za-z0-9_-]{1,64}\/[0-9a-f-]{36}\.(webp|jpg)$/;

/** Detect the image type from its first bytes — never trust the header. */
export function sniffImage(bytes: Uint8Array): "webp" | "jpg" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

/** "<userId>/<uuid>.<ext>" → its R2 key, or null for anything else. */
export function avatarKey(path: string): string | null {
  return FILE_RE.test(path) ? `avatars/${path}` : null;
}

/** The R2 key behind a user's `image`, when it's one we host. */
export function ownAvatarKey(image: string | null | undefined): string | null {
  return image?.startsWith(PUBLIC_PREFIX) ? avatarKey(image.slice(PUBLIC_PREFIX.length)) : null;
}

export const avatarUrl = (path: string) => `${PUBLIC_PREFIX}${path}`;

/** Remove a hosted avatar file (best effort — a stray file only costs bytes). */
export async function deleteAvatarFile(image: string | null | undefined) {
  const key = ownAvatarKey(image);
  if (key) await cvBucket().delete(key).catch((err) => console.error("avatar delete failed", err));
}

export const avatarBucket = cvBucket;
