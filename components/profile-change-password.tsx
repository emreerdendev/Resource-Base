"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import { IconInput } from "@/components/ui/icon-input";
import { authClient } from "@/lib/auth-client";
import { setMyPassword } from "@/lib/profile-actions";

const PW_MIN = 8;
const PW_MAX = 64;

/**
 * Password section for the profile editor. Two modes based on whether the user
 * already has a password (a `credential` account):
 *  - has password  → "Change password" (current + new + confirm)
 *  - OAuth-only     → "Set a password"  (new + confirm, no current) — lets
 *    Google/GitHub/GitLab users add email+password sign-in without the hidden
 *    forgot-password detour. Adding a password is safe: the user is already
 *    authenticated in this session.
 */
export function ProfileChangePassword() {
  const { t } = useTranslation();
  const id = useId();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  const refresh = () =>
    authClient.listAccounts().then((res) => {
      const accounts = (res?.data ?? []) as { providerId?: string }[];
      setHasPassword(accounts.some((a) => a.providerId === "credential"));
    });

  useEffect(() => {
    let active = true;
    authClient.listAccounts().then((res) => {
      if (!active) return;
      const accounts = (res?.data ?? []) as { providerId?: string }[];
      setHasPassword(accounts.some((a) => a.providerId === "credential"));
    });
    return () => {
      active = false;
    };
  }, []);

  const lengthErr = (v: string) =>
    !v ? t("validation.required") : v.length < PW_MIN || v.length > PW_MAX ? t("validation.password") : null;
  const errors = {
    current: hasPassword ? (current ? null : t("validation.required")) : null,
    next: lengthErr(next),
    confirm: !confirm ? t("validation.required") : confirm !== next ? t("validation.passwordMatch") : null,
  };
  const form = useFormErrors(errors);

  if (hasPassword === null) return null; // still loading — render nothing

  const title = hasPassword
    ? t("auth.changePassword")
    : t("auth.setPassword");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !form.check(e.currentTarget)) return;
    setPending(true);
    try {
      if (hasPassword) {
        const { error } = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        if (error) throw new Error(error.message ?? t("auth.failed"));
        toast.success(t("auth.passwordChanged"));
      } else {
        const { error } = await setMyPassword(next);
        if (error) throw new Error(t(error === "reauth" ? "account.reauthRequired" : "auth.failed"));
        toast.success(t("auth.passwordSet"));
        await refresh(); // flip the section into change-password mode
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      form.reset();
    }
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {!hasPassword && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("auth.setPasswordHint")}
        </p>
      )}
      <form className="mt-3 grid gap-3" onSubmit={submit} noValidate>
        {hasPassword && (
        <FormField id={`${id}-current`} error={form.show("current")}>
          <IconInput
            {...fieldProps(`${id}-current`, form.show("current"))}
            aria-label={t("auth.currentPassword")}
            icon={Lock}
            type="password"
            maxLength={PW_MAX}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onBlur={() => form.touch("current")}
            placeholder={t("auth.currentPassword")}
            autoComplete="current-password"
          />
        </FormField>
        )}
        <FormField id={`${id}-next`} error={form.show("next")}>
          <IconInput
            {...fieldProps(`${id}-next`, form.show("next"))}
            aria-label={t("auth.newPasswordPlaceholder")}
            icon={Lock}
            type="password"
            maxLength={PW_MAX}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            onBlur={() => form.touch("next")}
            placeholder={t("auth.newPasswordPlaceholder")}
            autoComplete="new-password"
          />
        </FormField>
        <FormField id={`${id}-confirm`} error={form.show("confirm")}>
          <IconInput
            {...fieldProps(`${id}-confirm`, form.show("confirm"))}
            aria-label={t("auth.confirmPasswordPlaceholder")}
            icon={Lock}
            type="password"
            maxLength={PW_MAX}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => form.touch("confirm")}
            placeholder={t("auth.confirmPasswordPlaceholder")}
            autoComplete="new-password"
          />
        </FormField>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {title}
        </Button>
      </form>
    </section>
  );
}
