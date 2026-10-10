"use client";

import { useState } from "react";
import { Briefcase, Globe, Mail, MapPin, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LinkedinIcon } from "@/components/brand-icons";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyModal } from "@/components/company-modal";
import { CompanyStatusMenu } from "@/components/company-status-menu";
import { hostLabel, primaryUrl } from "@/lib/company-utils";
import type { Company } from "@/lib/types";

/**
 * Compact company card: logo + name + where they work, the ways to apply as
 * icons, and the bookmark/status control. The card body opens the detail
 * modal with the actual emails and links.
 */
export function CompanyCard({ company }: { company: Company }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const places = [
    ...company.cities.map((c) => t(`companies.city.${c}`)),
    ...company.workModels.map((w) => t(`companies.workModel.${w}`)),
  ];
  const ways = [
    company.emails.length > 0 && {
      key: "email",
      icon: <Mail className="size-3.5" />,
      label: t("companies.channel.email"),
    },
    company.careerLinks.length > 0 && {
      key: "career",
      icon: <Briefcase className="size-3.5" />,
      label: t("companies.channel.career"),
    },
    company.linkedin && {
      key: "linkedin",
      icon: <LinkedinIcon className="size-3.5" />,
      label: t("companies.channel.linkedin"),
    },
    // A bare website is still a way in when nothing more specific is listed.
    company.website &&
      !company.emails.length &&
      !company.careerLinks.length && {
        key: "website",
        icon: <Globe className="size-3.5" />,
        label: t("companies.channel.website"),
      },
    company.channels.includes("hr") && {
      key: "hr",
      icon: <Users className="size-3.5" />,
      label: t("companies.channel.hr"),
    },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string }[];

  return (
    <>
      <div className="card-hover group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("company.viewDetails", { name: company.name })}
          className="absolute inset-0 z-0 cursor-pointer rounded-xl"
        />

        <div className="pointer-events-none flex items-center gap-3">
          <CompanyLogo company={company} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">{company.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              {places.length > 0 ? (
                <>
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{places.join(" · ")}</span>
                </>
              ) : company.sectors[0] ? (
                t(`companies.sector.${company.sectors[0]}`)
              ) : primaryUrl(company) ? (
                hostLabel(primaryUrl(company)!).split("/")[0]
              ) : (
                t("companies.unknownLocation")
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="pointer-events-none flex items-center gap-1">
            {ways.length > 0 ? (
              ways.map((w) => (
                <span
                  key={w.key}
                  title={w.label}
                  aria-label={w.label}
                  className="grid size-6 place-items-center rounded-md bg-muted/60"
                >
                  {w.icon}
                </span>
              ))
            ) : (
              <span className="text-[11px]">{t("companies.noContactShort")}</span>
            )}
          </div>
          <div className="ml-auto">
            <CompanyStatusMenu companyId={company._id} />
          </div>
        </div>
      </div>

      <CompanyModal company={company} open={open} onOpenChange={setOpen} />
    </>
  );
}
