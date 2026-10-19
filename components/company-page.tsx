"use client";

import { useState } from "react";
import { NavLink as Link } from "@/components/nav-link";
import { Check, ChevronRight, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompanyCard } from "@/components/company-card";
import { CompanyDetails } from "@/components/company-details";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyEditPanel, CompanyMeta, CompanyTitle, SuggestButton } from "@/components/company-modal";
import { Separator } from "@/components/ui/separator";
import { CompanyStatusMenu } from "@/components/company-status-menu";
import { Button } from "@/components/ui/button";
import type { CompanyWithRelated } from "@/lib/types";
import { ContributorNote } from "@/components/contributor-note";

/**
 * Deep-linkable company page — same body as the modal, plus related companies.
 * The application status stays top right; meta, Share and Suggest edit sit
 * under the details, like the resource page.
 */
export function CompanyPageView({ company }: { company: CompanyWithRelated }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
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
            {/* Name and "Open Page" are one link, like the resource page. */}
            <CompanyTitle company={company} url={url} large />
          </h1>
        </div>
        <CompanyStatusMenu companyId={company._id} size="md" />
      </div>

      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        <CompanyDetails company={company} />
        {company.contributorNote && (
          <ContributorNote note={company.contributorNote} userId={company.submittedBy} />
        )}
        <CompanyEditPanel
          company={company}
          editOpen={editOpen}
          setEditOpen={setEditOpen}
          viewOpen={viewOpen}
          setViewOpen={setViewOpen}
        />
        <div className="flex flex-col gap-y-5">
          <Separator />
          <CompanyMeta company={company} />
          {/* Share · suggest edit — the editor / pending suggestion open above. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="lg" onClick={share}>
              {copied ? <Check className="text-emerald-500" /> : <Share2 />}
              {copied ? t("resource.linkCopied") : t("resource.share")}
            </Button>
            <SuggestButton
              company={company}
              editOpen={editOpen}
              setEditOpen={setEditOpen}
              viewOpen={viewOpen}
              setViewOpen={setViewOpen}
            />
          </div>
        </div>
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
