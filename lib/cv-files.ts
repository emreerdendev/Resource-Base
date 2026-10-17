import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";


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

/**
 * Whether this signed-in email belongs to a site admin (the ADMIN_EMAILS
 * variable, comma-separated). Admins can open pending CVs from the Studio's
 * review link. The Sanity dataset is public on the free plan, so the link
 * itself must not grant access — being signed in as an admin does.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (getCloudflareContext().env as unknown as Record<string, string | undefined>).ADMIN_EMAILS ?? "";
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
