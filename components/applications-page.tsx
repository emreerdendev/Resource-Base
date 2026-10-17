"use client";

import { BriefcaseBusiness } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApplicationsTracker } from "@/components/applications-tracker";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { TrackerImportDialog } from "@/components/tracker-import-dialog";
import type { Company } from "@/lib/types";

export function ApplicationsPageView({ companies }: { companies: Company[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={BriefcaseBusiness}
        title={t("tracker.title")}
        description={t("tracker.subtitle")}
        actions={user && <TrackerImportDialog companies={companies} />}
      />
      <ApplicationsTracker companies={companies} />
    </div>
  );
}
