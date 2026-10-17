"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import { IconInput } from "@/components/ui/icon-input";
import { GoogleIcon, GithubIcon, GitlabIcon } from "@/components/brand-icons";
import { authClient } from "@/lib/auth-client";
import { markSignInIntent } from "@/components/auth/auth-provider";
import { Turnstile, turnstileEnabled } from "@/components/auth/turnstile";
import { setAuthHint } from "@/lib/auth-hint";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_MIN = 8;
const PW_MAX = 64;

function emailOk(v: string) {
  return EMAIL_RE.test(v.trim()) && v.trim().length <= 254;
}

/** Forward the Turnstile token to Better Auth as the captcha header. Empty
 * when captcha is disabled (no site key) — Better Auth only enforces it when
 * the secret key is set, so the two stay in sync. */
function captchaHeaders(token: string) {
  return token ? { headers: { "x-captcha-response": token } } : undefined;
}

export function AuthDialog({
  open,
  onOpenChange,
  getRedirect,
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns the post-login path to forward to after OAuth, if any. */
  getRedirect?: () => string | null;
  /** Optional warning shown above the form (e.g. account_not_linked). */
  notice?: string | null;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"auth" | "forgot" | "verify-sent">("auth");

  // Controlled fields (so buttons can be disabled until valid).
  const [siEmail, setSiEmail] = useState("");
  const [siPw, setSiPw] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPw, setSuPw] = useState("");
  const [fpEmail, setFpEmail] = useState("");

  // Turnstile (bot protection) token for the active form. Empty until the
  // challenge is solved; submit is blocked until then (when captcha is on).
  // resetKey is bumped after each submit to force a fresh single-use token.
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const captchaOk = !turnstileEnabled || captcha.length > 0;
  function resetCaptcha() {
    setCaptcha("");
    setCaptchaKey((k) => k + 1);
  }

  /**
   * Where to land after signing in: an explicit target (e.g. a form the user
   * was heading to), otherwise the page they're on now — so signing in from a
   * resource page brings them back to that resource, not the homepage.
   */
  function callbackPath() {
    const next = getRedirect?.();
    if (next && isSafePath(next)) return next;
    if (typeof window === "undefined") return "/";
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("next");
    url.searchParams.delete("error");
    return `${url.pathname}${url.search}`;
  }

  // Clear form fields after a submit — success or failure — so stale values
  // never linger (requested UX). Each helper resets only its own view's inputs.
  function resetSignIn() {
    setSiEmail("");
    setSiPw("");
    siForm.reset();
  }
  function resetSignUp() {
    setSuEmail("");
    setSuPw("");
    suForm.reset();
  }

  async function oauth(provider: "google" | "github" | "gitlab") {
    setPending(true);
    markSignInIntent();
    // errorCallbackURL must be a plain path (no query string — Better Auth
    // rejects that with "Invalid errorCallbackURL"). Better Auth appends its own
    // ?error=<code> (e.g. account_not_linked), which AuthProvider then handles.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: callbackPath(),
      errorCallbackURL: "/",
    });
    if (error) {
      toast.error(authErrorMessage(error));
      setPending(false);
    }
  }

  /** Map a Better Auth error to a user-facing message. */
  // Always a translated message: Better Auth's own `message` is English.
  function authErrorMessage(error: { code?: string; status?: number }): string {
    const code = error.code ?? "";
    // Captcha rejected (missing/invalid/failed verification) by the server.
    if (code.includes("CAPTCHA") || code === "MISSING_RESPONSE") return t("auth.captchaFailed");
    // Too many requests (Better Auth rate limit / per-recipient email cap).
    if (error.status === 429) return t("auth.tooManyEmails");
    if (code === "EMAIL_NOT_VERIFIED") return t("auth.emailNotVerified");
    if (code === "INVALID_EMAIL_OR_PASSWORD") return t("auth.invalidCredentials");
    if (code.startsWith("USER_ALREADY_EXISTS")) return t("auth.userExists");
    if (code === "DISPOSABLE_EMAIL") return t("auth.disposableEmail");
    if (code === "SIGNUPS_PAUSED") return t("auth.signupsPaused");
    if (code.startsWith("PASSWORD_TOO")) return t("auth.passwordTooShort");
    if (code === "INVALID_EMAIL") return t("auth.emailInvalid");
    return t("auth.failed");
  }

  async function signin() {
    setPending(true);
    markSignInIntent();
    try {
      const { error } = await authClient.signIn.email(
        { email: siEmail.trim(), password: siPw },
        captchaHeaders(captcha),
      );
      if (error) {
        // Unverified email/password account: Better Auth blocks sign-in with
        // EMAIL_NOT_VERIFIED (403) and, with sendOnSignIn, resends the link.
        // Tell the user to check their inbox rather than showing a raw error.
        throw new Error(authErrorMessage(error));
      }
      // Signed in: start loading the session (see lib/auth-hint). The welcome
      // toast is fired centrally in AuthProvider (on the user-id transition)
      // so it works for both email and OAuth sign-in.
      setAuthHint();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
      resetSignIn();
      resetCaptcha(); // token is single-use; force a fresh challenge
    }
  }

  async function signup() {
    setPending(true);
    try {
      // name seeds the auto-username (databaseHooks.user.create.after stems it,
      // then adds a random suffix), exactly like OAuth signups. Use the email
      // local-part; the user can change their handle later from Profile.
      const email = suEmail.trim();
      const { error } = await authClient.signUp.email(
        // callbackURL: the verification link brings them back to this page.
        { email, password: suPw, name: email.split("@")[0], callbackURL: callbackPath() },
        captchaHeaders(captcha),
      );
      if (error) throw new Error(authErrorMessage(error));
      // Verification is required: signUp does NOT create a session. Show a
      // check-your-inbox screen instead of closing the dialog.
      toast.success(t("auth.verifyEmailSent"));
      setView("verify-sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
      resetSignUp();
      resetCaptcha();
    }
  }

  async function forgot() {
    setPending(true);
    try {
      const { error } = await authClient.requestPasswordReset(
        {
          email: fpEmail.trim(),
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/reset-password`
              : "/reset-password",
        },
        captchaHeaders(captcha),
      );
      if (error) throw new Error(authErrorMessage(error));
      toast.success(t("auth.resetEmailSent"));
      setView("auth");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
      setFpEmail("");
      fpForm.reset();
      resetCaptcha();
    }
  }

  // Inline errors (shown after leaving a field or on submit) instead of the
  // browser's own validation popups.
  const emailErr = (v: string) =>
    !v.trim() ? t("validation.required") : emailOk(v) ? null : t("validation.email");
  const pwErr = (v: string) =>
    !v ? t("validation.required") : v.length < PW_MIN || v.length > PW_MAX ? t("validation.password") : null;
  const siForm = useFormErrors({ email: emailErr(siEmail), password: pwErr(siPw) });
  const suForm = useFormErrors({ email: emailErr(suEmail), password: pwErr(suPw) });
  const fpForm = useFormErrors({ email: emailErr(fpEmail) });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setView("auth");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        {view === "verify-sent" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("auth.verifyCheckInbox")}</DialogTitle>
              <DialogDescription>{t("auth.verifyEmailSent")}</DialogDescription>
            </DialogHeader>
            <div className="grid place-items-center gap-3 py-2 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("auth.verifyEmailHint")}
              </p>
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="justify-self-center"
              onClick={() => setView("auth")}
            >
              {t("auth.backToSignIn")}
            </Button>
          </>
        ) : view === "forgot" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("auth.forgotTitle")}</DialogTitle>
              <DialogDescription>{t("auth.forgotSubtitle")}</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!pending && captchaOk && fpForm.check(e.currentTarget)) forgot();
              }}
            >
              <FormField id="auth-fp-email" error={fpForm.show("email")}>
                <IconInput
                  {...fieldProps("auth-fp-email", fpForm.show("email"))}
                  onBlur={() => fpForm.touch("email")}
                  icon={Mail}
                  type="email"
                  maxLength={254}
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  aria-label={t("auth.emailPlaceholder")}
                  autoComplete="email"
                  autoFocus
                />
              </FormField>
              <Turnstile
                action="forgot-password"
                resetKey={captchaKey}
                onToken={setCaptcha}
              />
              <Button type="submit" disabled={!captchaOk || pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {t("auth.sendResetLink")}
              </Button>
              {!captchaOk && (
                <p className="text-center text-xs text-muted-foreground">
                  {t("auth.captchaRequired")}
                </p>
              )}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="justify-self-center"
                disabled={pending}
                onClick={() => {
                  resetCaptcha();
                  setView("auth");
                }}
              >
                {t("auth.backToSignIn")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("auth.title")}</DialogTitle>
              <DialogDescription>{t("auth.subtitle")}</DialogDescription>
            </DialogHeader>

            {notice && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                {notice}
              </div>
            )}

            <div className="grid gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => oauth("google")}
              >
                <GoogleIcon className="size-4" />
                {t("auth.google")}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => oauth("github")}
              >
                <GithubIcon className="size-4" />
                {t("auth.github")}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => oauth("gitlab")}
              >
                <GitlabIcon className="size-4" />
                {t("auth.gitlab")}
              </Button>
            </div>

            <div className="relative my-1 text-center text-xs text-muted-foreground">
              <span className="relative z-10 bg-popover px-2">
                {t("auth.or")}
              </span>
              <span className="absolute inset-x-0 top-1/2 z-0 h-px bg-border" />
            </div>

            <Tabs defaultValue="signin" onValueChange={resetCaptcha}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t("auth.signIn")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signUp")}</TabsTrigger>
              </TabsList>

              {/* Sign in */}
              <TabsContent value="signin">
                <form
                  className="grid gap-3 pt-2"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pending && captchaOk && siForm.check(e.currentTarget)) signin();
                  }}
                >
                  <FormField id="auth-si-email" error={siForm.show("email")}>
                    <IconInput
                      {...fieldProps("auth-si-email", siForm.show("email"))}
                      onBlur={() => siForm.touch("email")}
                      icon={Mail}
                      type="email"
                      maxLength={254}
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      aria-label={t("auth.emailPlaceholder")}
                      autoComplete="email"
                    />
                  </FormField>
                  <FormField id="auth-si-pw" error={siForm.show("password")}>
                    <IconInput
                      {...fieldProps("auth-si-pw", siForm.show("password"))}
                      onBlur={() => siForm.touch("password")}
                      icon={Lock}
                      type="password"
                      maxLength={PW_MAX}
                      value={siPw}
                      onChange={(e) => setSiPw(e.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                      aria-label={t("auth.passwordPlaceholder")}
                      autoComplete="current-password"
                    />
                  </FormField>
                  <Turnstile
                    action="signin"
                    resetKey={captchaKey}
                    onToken={setCaptcha}
                  />
                  <Button
                    type="submit"
                    disabled={!captchaOk || pending}
                  >
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    {t("auth.signIn")}
                  </Button>
                  {!captchaOk && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t("auth.captchaRequired")}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="justify-self-center"
                    disabled={pending}
                    onClick={() => {
                      resetCaptcha();
                      setView("forgot");
                    }}
                  >
                    {t("auth.forgotPassword")}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign up */}
              <TabsContent value="signup">
                <form
                  className="grid gap-3 pt-2"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pending && captchaOk && suForm.check(e.currentTarget)) signup();
                  }}
                >
                  <FormField id="auth-su-email" error={suForm.show("email")}>
                    <IconInput
                      {...fieldProps("auth-su-email", suForm.show("email"))}
                      onBlur={() => suForm.touch("email")}
                      icon={Mail}
                      type="email"
                      maxLength={254}
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      aria-label={t("auth.emailPlaceholder")}
                      autoComplete="email"
                    />
                  </FormField>
                  <FormField id="auth-su-pw" error={suForm.show("password")}>
                    <IconInput
                      {...fieldProps("auth-su-pw", suForm.show("password"))}
                      onBlur={() => suForm.touch("password")}
                      icon={Lock}
                      type="password"
                      maxLength={PW_MAX}
                      value={suPw}
                      onChange={(e) => setSuPw(e.target.value)}
                      placeholder={t("auth.passwordPlaceholder")}
                      aria-label={t("auth.passwordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <Turnstile
                    action="signup"
                    resetKey={captchaKey}
                    onToken={setCaptcha}
                  />
                  <Button
                    type="submit"
                    disabled={!captchaOk || pending}
                  >
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    {t("auth.createAccount")}
                  </Button>
                  {!captchaOk && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t("auth.captchaRequired")}
                    </p>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A same-site path ("/x"), never another origin ("//evil.com", "https://…"). */
export function isSafePath(p: string): boolean {
  // Same-site paths only. Browsers drop tabs/newlines and treat "\\" as "/",
  // so "/\t/evil.com" or "/\\evil.com" would leave the site: reject any control
  // character or backslash outright.
  return (
    typeof p === "string" &&
    p.startsWith("/") &&
    !p.startsWith("//") &&
    !/[\\\u0000-\u001f\u007f]/.test(p)
  );
}
