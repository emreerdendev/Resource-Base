import { getCloudflareContext } from "@opennextjs/cloudflare";
import { dailyCapReached, isRateLimited } from "@/lib/rate-limit";

/**
 * Single send helper. ALL outbound email goes through here, so swapping the
 * transport (or adding a fallback) later is a one-file change.
 *
 * Transport: Cloudflare Email Sending (the modern structured API). Requires the
 * Workers Paid plan, the domain enabled in Email Sending (SPF/DKIM/DMARC), and
 * the `send_email` binding `EMAIL` in wrangler.jsonc. The `from` domain must be
 * verified or sends fail with E_SENDER_NOT_VERIFIED.
 *
 * NOTE: this uses the new `env.EMAIL.send({ to, from, subject, html, text })`
 * API — NOT the legacy `cloudflare:email` EmailMessage/MIME flow (that's the
 * old Email Routing binding and doesn't work with Email Sending).
 */
type EmailBinding = {
  send: (msg: {
    to: string;
    from: string;
    subject: string;
    html?: string;
    text?: string;
  }) => Promise<unknown>;
};

// Global hard ceiling on emails per day, regardless of source. Per-IP rate
// limiting (Better Auth) stops a single attacker; this is the circuit breaker
// against DISTRIBUTED abuse exhausting the sending quota / running up cost.
const MAX_EMAILS_PER_DAY = 150;

// Per-RECIPIENT limits. Unlike per-IP limits (which an attacker defeats by
// rotating IPs), these are keyed on the destination address — the one thing an
// attacker bombarding someone's inbox (or spinning up signups to a victim's
// address) can't rotate. Stops "mail bombing" a single mailbox.
const RECIPIENT_COOLDOWN_SECONDS = 120; // min gap between two mails to the same address
const RECIPIENT_MAX_PER_HOUR = 3;
const RECIPIENT_MAX_PER_DAY = 5;

/** Reason a send was suppressed (surfaced to callers so the UI can explain). */
export type EmailResult = {
  ok: boolean;
  /** Why the send didn't go out. Absent when ok === true. */
  reason?: "no_binding" | "daily_cap" | "rate_limited";
};

/** SHA-256 hex of a string — used to key per-recipient counters without
 * storing raw email addresses. */
async function hashKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Per-recipient cooldown + hourly/daily caps (D1 counters, keyed on a hash of
 * the address). Returns true if this address is within limits.
 */
async function recipientAllowed(email: string): Promise<boolean> {
  const h = await hashKey(email);
  if (await isRateLimited(`mail-cd:${h}`, 1, RECIPIENT_COOLDOWN_SECONDS)) return false;
  if (await isRateLimited(`mail-h:${h}`, RECIPIENT_MAX_PER_HOUR, 3600)) return false;
  return !(await isRateLimited(`mail-d:${h}`, RECIPIENT_MAX_PER_DAY, 86400));
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Recipient-scoped abuse key. When set, the send is subject to per-recipient
   * cooldown + hourly/daily caps (defeats IP rotation). Pass the recipient email
   * for auth/transactional mail. Omit only for trusted internal sends.
   */
  dedupeKey?: string;
}): Promise<EmailResult> {
  const { env } = getCloudflareContext();
  const e = env as unknown as Record<string, unknown>;
  const emailBinding = e.EMAIL as EmailBinding | undefined;

  if (!emailBinding) {
    // No EMAIL binding (free plan / local dev): don't block the auth flow.
    console.warn(
      `[email] EMAIL binding unavailable; skipped send to ${opts.to} (${opts.subject})`,
    );
    return { ok: false, reason: "no_binding" };
  }

  // Per-recipient abuse limit (IP-independent) — checked before the global cap
  // so a single targeted address can't burn the shared daily quota.
  if (opts.dedupeKey && !(await recipientAllowed(opts.dedupeKey))) {
    console.warn(
      `[email] per-recipient limit hit; skipped send to ${opts.to} (${opts.subject})`,
    );
    return { ok: false, reason: "rate_limited" };
  }

  // Circuit breaker: hard daily cap across all senders.
  if (await dailyCapReached("email", MAX_EMAILS_PER_DAY)) {
    console.error(
      `[email] daily cap (${MAX_EMAILS_PER_DAY}) reached; skipped send to ${opts.to}`,
    );
    return { ok: false, reason: "daily_cap" };
  }

  const from = env.EMAIL_FROM || "noreply@resource-base.com";
  await emailBinding.send({
    to: opts.to,
    from,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  // Locally the binding is simulated by Miniflare: nothing is delivered (it
  // only writes the message to a temp folder). Print it so verification /
  // reset links can be followed during development.
  if ((env.BETTER_AUTH_URL ?? "").includes("localhost")) {
    console.info(
      `\n[email:dev] Not delivered locally — to: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n`,
    );
  }
  return { ok: true };
}
