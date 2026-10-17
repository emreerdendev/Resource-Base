import type { NextRequest } from "next/server";

/** Oldest webhook delivery we accept (Sanity retries failed ones for a while). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a signed Sanity webhook is recent. The signature header is
 * `t=<ms timestamp>,v1=<sig>` and the timestamp is part of what's signed, so
 * checking it (after the signature) stops a captured delivery from being
 * replayed later.
 */
export function isFreshWebhook(req: NextRequest): boolean {
  const header = req.headers.get("sanity-webhook-signature") ?? "";
  const t = Number(/(?:^|,)\s*t=(\d+)/.exec(header)?.[1]);
  if (!Number.isFinite(t) || t <= 0) return false;
  const ms = t < 1e12 ? t * 1000 : t; // accept seconds or milliseconds
  return Math.abs(Date.now() - ms) <= MAX_AGE_MS;
}
