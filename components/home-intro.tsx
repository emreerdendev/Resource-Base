"use client";

import { Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";

export function HomeIntro({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        <Boxes className="size-3.5 text-primary" />
        {t("home.badge", { count })}
      </div>
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        {t("nav.resources")}
      </h1>
      <p className="mx-auto mt-4 max-w-4xl text-balance text-muted-foreground">
        {t("home.subtitle")}
      </p>
    </div>
  );
}
