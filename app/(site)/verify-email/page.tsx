"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Turnstile, turnstileEnabled } from "@/components/auth/turnstile";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailOk(v: string) {
  return EMAIL_RE.test(v.trim()) && v.trim().length <= 254;
}

// Better Auth verifies the token at /api/auth/verify-email and, on success,
// redirects to the link's callbackURL (with autoSignInAfterVerification the
// user lands signed in). It only lands HERE when the token is invalid/expired
// (Better Auth redirects to the page with ?error=...). So this page is the
// "link expired — resend" recovery screen.
function VerifyEmail() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const error = params.get("error");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  // Turnstile (bot protection) — /send-verification-email is captcha-guarded.
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const captchaOk = !turnstileEnabled || captcha.length > 0;

  const valid = emailOk(email) && captchaOk && !pending;

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    try {
      const { error: sendError } = await authClient.sendVerificationEmail(
        { email: email.trim(), callbackURL: "/?auth=signin" },
        captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
      );
      if (sendError) {
        if (
          sendError.code?.startsWith("CAPTCHA") ||
          sendError.code === "MISSING_RESPONSE"
        )
          throw new Error(t("auth.captchaFailed"));
        if (sendError.status === 429) throw new Error(t("auth.tooManyEmails"));
        throw new Error(t("auth.failed"));
      }
      // Generic message (don't reveal whether the account exists / is verified).
      toast.success(t("auth.verificationResent"));
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
      setCaptcha("");
      setCaptchaKey((k) => k + 1); // token is single-use; force a fresh one
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-1 text-xl font-semibold">{t("auth.verifyTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {error ? t("auth.verifyExpired") : t("auth.verifySubtitle")}
      </p>
      <form className="grid gap-3" onSubmit={resend}>
        <IconInput
          icon={Mail}
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          autoComplete="email"
          autoFocus
        />
        <Turnstile
          action="resend-verification"
          resetKey={captchaKey}
          onToken={setCaptcha}
        />
        <Button type="submit" disabled={!valid}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("auth.resendVerification")}
        </Button>
        {emailOk(email) && !captchaOk && (
          <p className="text-center text-xs text-muted-foreground">
            {t("auth.captchaRequired")}
          </p>
        )}
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
