import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import type { BetterAuthPlugin } from "better-auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verifyEmail } from "@/lib/email-templates";

/** Stem a display name/email into a username base, then add a short suffix. */
function usernameStem(raw: string | null | undefined): string {
  const cleaned = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  return cleaned || "user";
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
  // Only wired up when TURNSTILE_SECRET_KEY is set, so local dev (no key) and
  // the OAuth-only path keep working unguarded.
  const turnstileSecret = (env as unknown as Record<string, string | undefined>)
    .TURNSTILE_SECRET_KEY;
  const plugins: BetterAuthPlugin[] = [];
  if (turnstileSecret) {
    plugins.push(
      captcha({
        provider: "cloudflare-turnstile",
        // Locally the widget runs with Cloudflare's always-pass test site key
        // (see components/auth/turnstile.tsx), whose tokens only verify
        // against the matching test secret.
        secretKey: isLocal ? "1x0000000000000000000000000000000AA" : turnstileSecret,
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
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/request-password-reset": { window: 3600, max: 3 }, // sends email
        "/forget-password": { window: 3600, max: 3 }, // alias
        "/send-verification-email": { window: 3600, max: 5 }, // sends email
        "/sign-up/email": { window: 3600, max: 5 },
        "/sign-in/email": { window: 900, max: 10 }, // allow retries, stop brute force
      },
    },
    emailAndPassword: {
      enabled: true,
      // Email/password signups must confirm their address before they can sign
      // in — stops abuse with fake/other people's emails. OAuth users are
      // unaffected (their provider verifies the email; emailVerified comes back
      // true on link).
      requireEmailVerification: true,
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
      sendOnSignIn: true, // resend it if an unverified user tries to sign in
      autoSignInAfterVerification: true, // clicking the link signs them in
      expiresIn: 60 * 60, // 1 hour, consistent with password reset
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
      },
    },
    account: {
      accountLinking: {
        // Link providers that share the same verified email to one account, so
        // signing in with Google/GitHub/GitLab/email for the same address all
        // resolve to a single user (avoids the "account_not_linked" error).
        enabled: true,
        trustedProviders: ["google", "github", "gitlab"],
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Auto-assign a unique username on signup (replaces handle_new_user).
          after: async (createdUser) => {
            const stem = usernameStem(createdUser.name || createdUser.email);
            for (let i = 0; i < 6; i++) {
              const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 5);
              try {
                await db
                  .update(schema.user)
                  .set({ username: `${stem}-${suffix}` })
                  .where(eq(schema.user.id, createdUser.id));
                break;
              } catch (e) {
                if (String(e).includes("UNIQUE")) continue;
                throw e;
              }
            }
          },
        },
      },
    },
    user: {
      additionalFields: {
        username: { type: "string", required: false, input: false },
        fullName: { type: "string", required: false },
        bio: { type: "string", required: false },
        portfolioUrl: { type: "string", required: false },
        githubUrl: { type: "string", required: false },
        twitterUrl: { type: "string", required: false },
        instagramUrl: { type: "string", required: false },
        dribbbleUrl: { type: "string", required: false },
        showEmail: { type: "boolean", required: false, defaultValue: false },
      },
    },
    // captcha (if enabled) runs before nextCookies; nextCookies MUST be last.
    plugins: [...plugins, nextCookies()],
  });
}
