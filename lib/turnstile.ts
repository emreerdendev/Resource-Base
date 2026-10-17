import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Cloudflare's always-pass test secret, used in local development. */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

/**
 * Check a Turnstile token for routes outside Better Auth (which checks its own).
 * Fails closed: no token, no secret in production, or a failed check is false.
 */
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const env = getCloudflareContext().env as unknown as Record<string, string | undefined>;
  const isLocal = (env.BETTER_AUTH_URL ?? "").includes("localhost");
  const secret = isLocal ? TEST_SECRET : env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
