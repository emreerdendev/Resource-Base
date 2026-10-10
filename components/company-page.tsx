"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompanyCard } from "@/components/company-card";
import { CompanyDetails } from "@/components/company-details";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyStatusMenu } from "@/components/company-status-menu";
import { Button } from "@/components/ui/button";
import { hostLabel } from "@/lib/company-utils";
import type { CompanyWithRelated } from "@/lib/types";

/** Deep-linkable company page — same body as the modal, plus related companies. */
export function CompanyPageView({ company }: { company: CompanyWithRelated }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // Only the company's own site — career platforms live under "How to apply".
  const url = company.website;

  async function share() {
    const href = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: company.name, url: href });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/companies" className="hover:text-foreground">
          {t("nav.companies")}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{company.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-4">
        <CompanyLogo company={company} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={hostLabel(url)}
                className="underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
              >
                {company.name}
                <ArrowUpRight className="ml-1 inline size-4 align-baseline opacity-60" />
              </a>
            ) : (
              company.name
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={share}>
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            {t("resource.share")}
          </Button>
          <CompanyStatusMenu companyId={company._id} size="md" />
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <CompanyDetails company={company} />
      </div>

      {company.related.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("company.related")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.related.map((c) => (
              <CompanyCard key={c._id} company={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
