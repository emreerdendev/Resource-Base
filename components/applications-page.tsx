"use client";

import { BriefcaseBusiness } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApplicationsTracker } from "@/components/applications-tracker";
import type { Company } from "@/lib/types";

export function ApplicationsPageView({ companies }: { companies: Company[] }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <BriefcaseBusiness className="size-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">{t("tracker.title")}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{t("tracker.subtitle")}</p>
      </div>
      <ApplicationsTracker companies={companies} />
    </div>
  );
}
