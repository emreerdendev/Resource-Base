"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Building2, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

/**
 * Invites visitors to contribute a resource or a company (and sign in if
 * needed). Two variants: a full "band" under the listings, and a compact
 * prompt for empty search results. Signed-out users get the auth modal first.
 */
export function SubmitCta({
  variant = "band",
  kind = "resource",
  name,
}: {
  variant?: "band" | "compact";
  kind?: "resource" | "company";
  /** Prefills the company name (e.g. the search that found nothing). */
  name?: string;
}) {
  const { t } = useTranslation();
  const { user, openAuth } = useAuth();
  const company = kind === "company";
  const k = company ? "cta.company" : "cta";
  const href = company
    ? `/submit?type=company${name?.trim() ? `&name=${encodeURIComponent(name.trim())}` : ""}`
    : "/submit";

  const cta = user ? (
    <Button asChild>
      <Link href={href}>
        <Plus className="size-4" />
        {t(`${k}.submit`)}
      </Link>
    </Button>
  ) : (
    // Guests: open sign-in in place, then forward to /submit after auth.
    <Button onClick={() => openAuth(href)}>
      <Plus className="size-4" />
      {t(`${k}.submit`)}
    </Button>
  );

  if (variant === "compact") {
    return (
      <div className="mt-4 flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">{t(`${k}.emptyPrompt`)}</p>
        {cta}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-12 flex flex-col items-center gap-4 rounded-xl border border-border/70 bg-card/40 px-6 py-10 text-center backdrop-blur-sm sm:flex-row sm:justify-between sm:text-left",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {company ? <Building2 className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <div>
          <p className="font-semibold tracking-tight">{t(`${k}.title`)}</p>
          <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
            {t(`${k}.subtitle`)}
          </p>
        </div>
      </div>
      <div className="shrink-0">{cta}</div>
    </div>
  );
}
