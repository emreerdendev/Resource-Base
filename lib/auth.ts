import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import type { BetterAuthPlugin } from "better-auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lt } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { isDisposableEmail } from "@/lib/disposable-email";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verifyEmail } from "@/lib/email-templates";
import { pickUsername, usernameFor } from "@/lib/username-gen";

/** Unverified email/password accounts are suspended after this long. */
export const VERIFY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;


/** Bound a new user's display name and keep only an https avatar URL. */
function cleanIdentity(data: { name?: unknown; image?: unknown }) {
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 60) : "";
  const image =
    typeof data.image === "string" && data.image.length <= 500 && data.image.startsWith("https://")
      ? data.image
      : null;
  return { name, image };
}

/**
 * Better Auth instance — built PER REQUEST (the Drizzle adapter depends on the
 * per-request D1 binding from getCloudflareContext(); env is undefined at module
 * scope on workerd). Always `await getAuth()`.
 */
export async function getAuth() {
  const { env } = getCloudflareContext();
  const db = drizzle(env.DB, { schema });
  const isLocal = (env.BETTER_AUTH_URL ?? "").includes("localhost");

  // Bot protection (Cloudflare Turnstile). The captcha plugin verifies an
  // `x-captcha-response` token (sent by the widget) against Cloudflare before
  // letting the request reach the account-creation / email-sending endpoints —
  // this is what stops a bot from mass-registering random addresses and firing
  // verification mail at scale (per-IP limits don't, since bots rotate IPs).
  // Always on, and it fails closed: in production a missing
  // TURNSTILE_SECRET_KEY makes these endpoints refuse requests instead of
  // silently running unguarded. Locally the test secret is used.
  const vars = env as unknown as Record<string, string | undefined>;
  const turnstileSecret = vars.TURNSTILE_SECRET_KEY;
  const plugins: BetterAuthPlugin[] = [];
  {
    plugins.push(
      captcha({
        provider: "cloudflare-turnstile",
        // Locally the widget runs with Cloudflare's always-pass test site key
        // (see components/auth/turnstile.tsx), whose tokens only verify
        // against the matching test secret.
        secretKey: isLocal ? "1x0000000000000000000000000000000AA" : (turnstileSecret ?? "missing"),
        // Guard every endpoint that creates an account or sends an email.
        endpoints: [
          "/sign-up/email",
          "/sign-in/email",
          "/send-verification-email",
          "/request-password-reset",
          "/forget-password",
        ],
      }),
    );
  }

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    // The signed session is cached in a short-lived cookie, so most session
    // checks (every server action, every get-session) skip the D1 lookup.
    // Trade-off: a revoked session stays usable for up to 5 minutes.
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    secret: env.BETTER_AUTH_SECRET,
    // Locally, derive the base URL from the incoming request so both `next dev`
    // (:3000) and `cf:preview` (:8788) build the right OAuth redirect_uri;
    // a fixed :8788 made every provider reject sign-ins from :3000.
    baseURL: isLocal ? undefined : env.BETTER_AUTH_URL,
    // Better Auth rejects requests whose Origin isn't trusted ("Invalid origin").
    // In local dev (BETTER_AUTH_URL on localhost) accept any origin so both
    // `next dev` (:3000) and `cf:preview` (:8788) work; in production only the
    // real domains are trusted (CSRF protection).
    trustedOrigins: isLocal
      ? ["*"]
      : ["https://resource-base.com", "https://www.resource-base.com"],
    // Cloudflare passes the real client IP in cf-connecting-ip. Without this,
    // Better Auth can't identify clients and lumps everyone into one shared
    // rate-limit bucket → spurious 429s (and reset requests never reaching
    // sendResetPassword).
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    // Per-IP rate limiting, persisted in D1 (the `rateLimit` table) so it holds
    // across Worker isolates — the default in-memory store resets per isolate.
    // Strict limits on email-sending + account-creation paths to block abuse
    // ("denial of wallet" / brute force). Windows are in SECONDS.
    //
    // The global window is an hour on purpose: Better Auth prunes rows older
    // than the global window, so a 60s window silently wiped the hourly
    // counters below and turned them into per-minute limits.
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 3600,
      max: 300,
      customRules: {
        // Read-only and called on every page load / tab focus — limiting it
        // would cost a D1 write per call for no protection.
        "/get-session": false,
        // Keyed by IP, and one IP can be a whole office, campus or mobile
        // carrier. Turnstile already stops scripts on all of these, and every
        // email also has per-address and daily caps (lib/email.ts), so these
        // only bound volume.
        "/request-password-reset": { window: 3600, max: 10 }, // sends email
        "/forget-password": { window: 3600, max: 10 }, // alias
        "/send-verification-email": { window: 3600, max: 10 }, // sends email
        "/sign-up/email": { window: 3600, max: 20 },
        "/sign-in/email": { window: 900, max: 30 }, // allow retries, stop brute force
      },
    },
    emailAndPassword: {
      enabled: true,
      // Email/password accounts can sign in right away — so a delayed or
      // capped verification email never locks anyone out — but every write is
      // locked until the address is verified (lib/authz requireVerifiedUser),
      // and an account left unverified for 7 days is suspended (daily cron;
      // see the session hook below). OAuth users arrive verified.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 64,
      sendResetPassword: async ({ user, url }) => {
        const mail = resetPasswordEmail(url);
        await sendEmail({
          to: user.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          dedupeKey: user.email, // per-recipient abuse limit (IP-independent)
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true, // fire the verification email right after signup
      autoSignInAfterVerification: true, // clicking the link signs them in
      expiresIn: 24 * 60 * 60, // a day; a new link can be sent any time
      sendVerificationEmail: async ({ user, url }) => {
        const mail = verifyEmail(url);
        await sendEmail({
          to: user.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          dedupeKey: user.email, // per-recipient abuse limit (IP-independent)
        });
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
      gitlab: {
        clientId: env.GITLAB_CLIENT_ID,
        clientSecret: env.GITLAB_CLIENT_SECRET,
        // GitLab's /user response has no `email_verified`, so Better Auth
        // marked every GitLab email unverified: signing in with GitLab to an
        // existing account was refused ("account not linked"), and accounts
        // created with GitLab couldn't later link Google/GitHub. GitLab only
        // lets confirmed accounts sign in with a confirmed primary email, which
        // `confirmed_at` reflects.
        mapProfileToUser: (profile) => ({
          emailVerified: Boolean((profile as { confirmed_at?: string | null }).confirmed_at),
        }),
      },
    },
    account: {
      accountLinking: {
        // Link providers that share the same verified email to one account, so
        // signing in with Google/GitHub/GitLab/email for the same address all
        // resolve to a single user (avoids the "account_not_linked" error).
        enabled: true,
        // Trusted = linked even without the provider confirming the email.
        // Only Google always verifies it; GitHub and GitLab report verification
        // themselves (GitLab via the mapping above), so they link whenever
        // their email is confirmed.
        trustedProviders: ["google"],
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Sign-up input and provider profiles both land here; keep the
          // fields that end up on public profiles bounded and http(s)-only.
          before: async (data) => {
            // Emergency switch (set SIGNUPS_PAUSED=1 in the dashboard) and
            // throwaway inboxes: no new account is created.
            if (vars.SIGNUPS_PAUSED === "1")
              throw new APIError("FORBIDDEN", { message: "Sign-ups are paused.", code: "SIGNUPS_PAUSED" });
            if (typeof data.email === "string" && isDisposableEmail(data.email))
              throw new APIError("BAD_REQUEST", { message: "Disposable email.", code: "DISPOSABLE_EMAIL" });
            const identity = cleanIdentity(data);
            const email = typeof data.email === "string" ? data.email : "";
            // Username, Full Name and the verification deadline are written in
            // the same insert as the account, so an account can never exist
            // without them (a separate update after it could fail and leave
            // one with no username, hence no public profile).
            //  - Full Name: the provider's name for Google/GitHub/GitLab, the
            //    email's local part (e.g. "ahmet.yilmaz") for email sign-ups.
            //  - Username: stemmed from that name (else the email) plus a
            //    random suffix, checked to be free.
            //  - Unverified emails get 7 days to verify.
            const fullName = identity.name && !identity.name.includes("@") ? identity.name : null;
            const username = await pickUsername(db, usernameFor(identity.name, email));
            const verifyDeadline = data.emailVerified ? null : new Date(Date.now() + VERIFY_WINDOW_MS);
            return { data: { ...data, ...identity, fullName, username, verifyDeadline } };
          },
        },
      },
      account: {
        create: {
          // Connecting Google/GitHub/GitLab to an existing account only
          // succeeds when that provider vouches for the account's own email
          // (Google always; GitHub/GitLab only if verified there — Better Auth
          // refuses the link otherwise, and requires the same address). So a
          // linked provider proves the email: mark it verified, which also
          // ends the 7-day window and lifts a suspension. Accounts created by
          // this very sign-up (under a minute old) are left alone: their
          // status already came from the provider.
          after: async (account) => {
            if (account.providerId === "credential") return;
            await db
              .update(schema.user)
              .set({ emailVerified: true, verifyDeadline: null, suspendedAt: null, updatedAt: new Date() })
              .where(
                and(
                  eq(schema.user.id, account.userId),
                  eq(schema.user.emailVerified, false),
                  lt(schema.user.createdAt, new Date(Date.now() - 60_000)),
                ),
              );
          },
        },
      },
      session: {
        create: {
          // Suspended accounts can't sign in — unless they've verified their
          // email since (e.g. by the link), which lifts the suspension. An
          // account past its deadline that the daily cron hasn't reached yet
          // is suspended here.
          before: async (session) => {
            const [u] = await db
              .select({
                emailVerified: schema.user.emailVerified,
                verifyDeadline: schema.user.verifyDeadline,
                suspendedAt: schema.user.suspendedAt,
              })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1);
            if (!u) return;
            if (u.emailVerified) {
              if (u.suspendedAt || u.verifyDeadline) {
                await db
                  .update(schema.user)
                  .set({ suspendedAt: null, verifyDeadline: null })
                  .where(eq(schema.user.id, session.userId));
              }
              return;
            }
            const overdue = u.verifyDeadline && u.verifyDeadline.getTime() < Date.now();
            if (u.suspendedAt || overdue) {
              if (!u.suspendedAt) {
                await db
                  .update(schema.user)
                  .set({ suspendedAt: new Date() })
                  .where(eq(schema.user.id, session.userId));
              }
              throw new APIError("FORBIDDEN", { message: "Account suspended.", code: "ACCOUNT_SUSPENDED" });
            }
          },
        },
      },
    },
    // Profile fields are written only by lib/profile-actions (which validates
    // them), never through Better Auth's own endpoints: `input: false` keeps
    // them out of sign-up, and the generic update/delete endpoints are off.
    disabledPaths: ["/update-user", "/change-email", "/delete-user"],
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: false },
        fullName: { type: "string", required: false, input: false },
        bio: { type: "string", required: false, input: false },
        showEmail: { type: "boolean", required: false, defaultValue: false, input: false },
        // Shown in the "verify your email" banner (days left).
        verifyDeadline: { type: "date", required: false, input: false },
      },
    },
    // captcha (if enabled) runs before nextCookies; nextCookies MUST be last.
    plugins: [...plugins, nextCookies()],
  });
}
