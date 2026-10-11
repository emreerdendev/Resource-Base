"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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

  if (hasPassword === null) return null; // still loading — render nothing

  const title = hasPassword
    ? t("auth.changePassword")
    : t("auth.setPassword");
  const valid =
    next.length >= PW_MIN &&
    next === confirm &&
    (hasPassword ? current.length >= PW_MIN : true) &&
    !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
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
      <form className="mt-3 grid gap-3" onSubmit={submit}>
        {hasPassword && (
          <IconInput
            icon={Lock}
            type="password"
            required
            minLength={PW_MIN}
            maxLength={PW_MAX}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder={t("auth.currentPassword")}
            autoComplete="current-password"
          />
        )}
        <IconInput
          icon={Lock}
          type="password"
          required
          minLength={PW_MIN}
          maxLength={PW_MAX}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t("auth.newPasswordPlaceholder")}
          autoComplete="new-password"
        />
        <IconInput
          icon={Lock}
          type="password"
          required
          minLength={PW_MIN}
          maxLength={PW_MAX}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("auth.confirmPasswordPlaceholder")}
          autoComplete="new-password"
        />
        {confirm.length > 0 && next !== confirm && (
          <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
        )}
        <Button type="submit" disabled={!valid} className="w-fit">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {title}
        </Button>
      </form>
    </section>
  );
}
