"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";

const PW_MIN = 8;
const PW_MAX = 64;

function ResetForm() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const linkError = params.get("error");
  const [pending, setPending] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  if (linkError || !token) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("auth.resetLinkInvalid")}
      </p>
    );
  }

  const valid = pw.length >= PW_MIN && pw === confirm && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: pw,
      token: token!,
    });
    setPending(false);
    if (error) {
      toast.error(t(error.code === "INVALID_TOKEN" ? "auth.resetLinkInvalid" : "auth.failed"));
      setPw("");
      setConfirm("");
      return;
    }
    toast.success(t("auth.passwordReset"));
    router.push("/?auth=signin");
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <IconInput
        icon={Lock}
        type="password"
        required
        minLength={PW_MIN}
        maxLength={PW_MAX}
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder={t("auth.newPasswordPlaceholder")}
        aria-label={t("auth.newPasswordPlaceholder")}
        autoComplete="new-password"
        autoFocus
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
        aria-label={t("auth.confirmPasswordPlaceholder")}
        autoComplete="new-password"
      />
      {confirm.length > 0 && pw !== confirm && (
        <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
      )}
      <Button type="submit" disabled={!valid}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t("auth.setNewPassword")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="mb-1 text-xl font-semibold">{t("auth.resetTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t("auth.resetSubtitle")}
      </p>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
