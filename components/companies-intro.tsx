"use client";

import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/** CSS-only entrance (tw-animate-css) so the hero is visible before hydration. */
const ENTER = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500";

export function CompaniesIntro({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div
        className={`mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground ${ENTER} delay-75`}
      >
        <Building2 className="size-3.5 text-primary" />
        {t("companies.badge", { count })}
      </div>
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        {t("nav.companies")}
      </h1>
      <p className="mx-auto mt-4 max-w-4xl text-balance text-muted-foreground">
        {t("companies.subtitle")}
      </p>
    </div>
  );
}
