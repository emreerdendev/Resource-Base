"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MailWarning } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { useCooldown } from "@/lib/use-cooldown";
import { Button } from "@/components/ui/button";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shown to signed-in users whose email isn't verified yet: everything that
 * saves or shares is locked until they are, and the account is suspended
 * when the 7 days run out. One click sends a new link.
 */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const wait = useCooldown();
  // Read once: the count only needs day precision.
  const [now] = useState(() => Date.now());
  if (!user || user.emailVerified) return null;

  const deadline = (user as { verifyDeadline?: string | Date | null }).verifyDeadline;
  // Ceil so "less than a day" still reads as 1 day.
  const days = deadline
    ? Math.max(1, Math.ceil((new Date(deadline).getTime() - now) / DAY_MS))
    : 7;

  async function resend() {
    setPending(true);
    try {
      const res = await fetch("/api/account/verify-email", { method: "POST" });
      if (res.status === 429) throw new Error(t("auth.tooManyEmails"));
      if (!res.ok) throw new Error(t("auth.failed"));
      toast.success(t("verifyBanner.sent", { email: user!.email }));
      wait.start();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <MailWarning className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{t("verifyBanner.title")}</span>{" "}
        <span className="text-muted-foreground">{t("verifyBanner.body", { count: days, email: user.email })}</span>
      </p>
      <Button size="sm" variant="outline" onClick={resend} disabled={pending || wait.left > 0}>
        {pending && <Loader2 className="size-3.5 animate-spin" />}
        {wait.left > 0 ? t("suspended.wait", { count: wait.left }) : t("verifyBanner.resend")}
      </Button>
    </div>
  );
}
