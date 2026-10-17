import "server-only";

import { createHmac } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { safeEqual } from "@/lib/request";

/** How long the reviewer link stored in Sanity stays valid. */
const REVIEW_LINK_TTL_SEC = 30 * 24 * 60 * 60;

export function cvBucket(): R2Bucket {
  const bucket = getCloudflareContext().env.CV_BUCKET;
  if (!bucket) throw new Error("CV_BUCKET binding missing");
  return bucket;
}

/**
 * Accept only real, inert PDFs: the %PDF header, and none of the actions a PDF
 * can use to run code or open things (JavaScript, launch, embedded files).
 * A CV never needs them, so a file containing them is rejected outright.
 */
export function checkPdf(bytes: Uint8Array): "ok" | "not_pdf" | "unsafe" {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) return "not_pdf";
  const body = new TextDecoder("latin1").decode(bytes);
  // Names inside compressed object streams aren't visible here; the file is
  // also served sandboxed (see the file route), so this is the first layer.
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/.test(body)) return "unsafe";
  return "ok";
}

function sign(id: string, exp: number): string {
  const secret = getCloudflareContext().env.BETTER_AUTH_SECRET;
  return createHmac("sha256", secret).update(`cv-file:${id}:${exp}`).digest("base64url");
}

/** A time-limited link that opens a (possibly unpublished) CV, for the Sanity reviewer. */
export function reviewLink(origin: string, id: string): string {
  const exp = Math.floor(Date.now() / 1000) + REVIEW_LINK_TTL_SEC;
  return `${origin}/api/cv/${id}/file?exp=${exp}&sig=${sign(id, exp)}`;
}

export function isValidReviewSignature(id: string, exp: string | null, sig: string | null) {
  const e = Number(exp);
  if (!sig || !Number.isInteger(e) || e < Date.now() / 1000) return false;
  return safeEqual(sig, sign(id, e));
}
