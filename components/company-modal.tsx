"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, Info, Loader2, PencilLine, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { AddedByLink, CompanyDetails } from "@/components/company-details";
import { CompanyEditEditor } from "@/components/company-edit-editor";
import { CompanyEditProposal } from "@/components/company-edit-proposal";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyStatusMenu } from "@/components/company-status-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useSubmissions } from "@/lib/submissions";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Detail view for a company, opened from its card (Companies and My
 * Applications). Laid out like the resource modal: name + "Open Page" as one
 * link, the details, then meta and a details · suggest edit · status row.
 */
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
  const close = () => change(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  // Closing resets the inline editor.
  const change = (o: boolean) => {
    if (!o) {
      setEditOpen(false);
      setViewOpen(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[85vh] gap-6 overflow-y-auto p-4 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3.5 pr-6 text-left">
          <CompanyLogo company={company} size="lg" />
          <DialogTitle className="min-w-0 flex-1 text-base leading-snug">
            <CompanyTitle company={company} url={url} />
          </DialogTitle>
          <DialogDescription className="sr-only">{t("company.howToApply")}</DialogDescription>
        </DialogHeader>

        <CompanyDetails company={company} onNavigate={close} />
        <CompanyEditPanel
          company={company}
          editOpen={editOpen}
          setEditOpen={setEditOpen}
          viewOpen={viewOpen}
          setViewOpen={setViewOpen}
          onNavigate={close}
        />

        <div className="flex flex-col gap-y-4">
          <Separator />
          <CompanyMeta company={company} onNavigate={close} />

          {/* Actions — details · suggest edit · application status, equal widths. */}
          <div className="grid grid-cols-3 gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href={`/company/${company.slug}`} onClick={close}>
                <Info />
                {t("modal.details")}
              </Link>
            </Button>
            <SuggestButton
              company={company}
              editOpen={editOpen}
              setEditOpen={setEditOpen}
              viewOpen={viewOpen}
              setViewOpen={setViewOpen}
            />
            <CompanyStatusMenu companyId={company._id} size="lg" className="w-full min-w-0" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Name + "Open Page" as one link to the company's site, on one baseline. */
export function CompanyTitle({ company, url, large = false }: { company: Company; url?: string; large?: boolean }) {
  const { t } = useTranslation();
  if (!url) return <>{company.name}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="group underline-offset-4">
      <span className="group-hover:underline">{company.name}</span>{" "}
      <span
        className={cn(
          "ml-1 inline-flex items-baseline gap-1 font-normal whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground group-hover:underline",
          large ? "text-sm tracking-normal" : "text-xs",
        )}
      >
        {t("company.openPage")}
        <ExternalLink className={cn("self-center", large ? "size-3.5" : "size-3")} />
      </span>
    </a>
  );
}

/** "Added <date>" and who suggested it. */
export function CompanyMeta({ company, onNavigate }: { company: Company; onNavigate?: () => void }) {
  const { t, i18n } = useTranslation();
  const addedOn = company.addedAt
    ? new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long", day: "numeric" }).format(
        new Date(company.addedAt),
      )
    : undefined;
  if (!addedOn && !company.submittedBy) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {addedOn && <span>{t("modal.addedOn", { date: addedOn })}</span>}
      {company.submittedBy && <AddedByLink userId={company.submittedBy} onNavigate={onNavigate} />}
    </div>
  );
}

/** The user's open edit suggestion for this company, if any. */
export function usePendingCompanyEdit(companyId: string) {
  const { user } = useAuth();
  const { items, loading, reload } = useSubmissions();
  const pending = user
    ? items.find((s) => s.kind === "companyEdit" && s.target_resource_id === companyId && s.status === "pending")
    : undefined;
  return { pending, loading: Boolean(user) && loading, reload };
}

type EditState = {
  company: Company;
  editOpen: boolean;
  setEditOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  viewOpen: boolean;
  setViewOpen: (v: boolean | ((o: boolean) => boolean)) => void;
};

/** Suggest edit → the inline editor; once one is pending → a read-only view. */
export function SuggestButton({ company, editOpen, setEditOpen, viewOpen, setViewOpen }: EditState) {
  const { t } = useTranslation();
  const { user, openAuth } = useAuth();
  const { pending, loading } = usePendingCompanyEdit(company._id);
  if (loading) {
    return (
      <Button variant="outline" size="lg" disabled className="min-w-0">
        <Loader2 className="animate-spin" />
        <span className="truncate">{t("taxonomy.editShort")}</span>
      </Button>
    );
  }
  if (pending) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setViewOpen((o) => !o)}
        aria-pressed={viewOpen}
        title={t("taxonomy.pendingSuggestion")}
        className="min-w-0 text-amber-600 dark:text-amber-400"
      >
        <Clock />
        <span className="truncate">{t("taxonomy.pending")}</span>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => (user ? setEditOpen((o) => !o) : openAuth())}
      aria-pressed={editOpen}
      className="min-w-0"
    >
      <PencilLine />
      <span className="truncate">{t("taxonomy.editShort")}</span>
    </Button>
  );
}

/** The editor or the pending suggestion, shown above the details. */
export function CompanyEditPanel({
  company,
  editOpen,
  setEditOpen,
  viewOpen,
  setViewOpen,
  onNavigate,
}: EditState & { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { pending, reload } = usePendingCompanyEdit(company._id);
  // Opened from the button below the details — bring it into view.
  const ref = useRef<HTMLDivElement>(null);
  const shown = (editOpen && !pending) || (viewOpen && !!pending);
  useEffect(() => {
    if (shown) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shown]);
  if (editOpen && !pending) {
    return (
      <div ref={ref}>
      <CompanyEditEditor
        company={company}
        onCancel={() => setEditOpen(false)}
        onDone={() => {
          setEditOpen(false);
          reload();
        }}
      />
      </div>
    );
  }
  if (!viewOpen || !pending) return null;
  return (
    <div ref={ref} className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Clock className="size-3.5" />
        <span className="flex-1">{t("taxonomy.yourSuggestion")}</span>
        <button
          type="button"
          onClick={() => setViewOpen(false)}
          aria-label={t("taxonomy.close")}
          title={t("taxonomy.close")}
          className="-m-1 grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <CompanyEditProposal
        proposed={pending.proposed_fields}
        original={pending.original_fields}
        proposeRemoval={pending.propose_removal}
        note={pending.note}
      />
      {/* Where the user follows this suggestion's review. */}
      <Link
        href="/submissions"
        onClick={onNavigate}
        className="inline-flex items-center gap-1 self-end text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
      >
        {t("taxonomy.track")} <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
