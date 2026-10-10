"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompanyDetails } from "@/components/company-details";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyStatusMenu } from "@/components/company-status-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Company } from "@/lib/types";

/** Detail view for a company, opened from its card. */
export function CompanyModal({
  company,
  open,
  onOpenChange,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  // Only the company's own site — career platforms live under "How to apply".
  const url = company.website;
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 pr-8 text-left">
          <CompanyLogo company={company} size="lg" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg leading-tight">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
                >
                  {company.name}
                  <ArrowUpRight className="ml-1 inline size-3.5 align-baseline opacity-60" />
                </a>
              ) : (
                company.name
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="-mt-1 flex flex-wrap items-center justify-between gap-2">
          <CompanyStatusMenu companyId={company._id} size="md" />
          <Link
            href={`/company/${company.slug}`}
            onClick={close}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("company.openPage")} <ExternalLink className="size-3" />
          </Link>
        </div>

        <CompanyDetails company={company} onNavigate={close} />
      </DialogContent>
    </Dialog>
  );
}
