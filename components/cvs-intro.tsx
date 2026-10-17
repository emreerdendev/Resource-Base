"use client";

import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

/** CSS-only entrance (tw-animate-css), matching the other directory intros. */
const ENTER = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500";

/** Header of /cvs, laid out like the Resources and Companies intros. */
export function CvsIntro({ count }: { count: number | null }) {
  const { t } = useTranslation();
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div
        className={`mx-auto mb-4 inline-flex min-h-6 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground ${ENTER} delay-75`}
      >
        <FileText className="size-3.5 text-primary" />
        {count === null ? t("command.loading") : t("cvs.badge", { count })}
      </div>
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{t("nav.cvs")}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">{t("cvs.subtitle")}</p>
    </div>
  );
}
