"use client";

import { Bookmark, BookmarkCheck, Check, ChevronDown, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/company-taxonomy";
import { cn } from "@/lib/utils";

/** Dot / pill colours per status — readable in both themes. */
export const STATUS_STYLES: Record<ApplicationStatus, { dot: string; pill: string }> = {
  saved: {
    dot: "bg-primary",
    pill: "border-primary/30 bg-primary/10 text-primary",
  },
  applied: {
    dot: "bg-sky-500",
    pill: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  interview: {
    dot: "bg-amber-500",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  offer: {
    dot: "bg-emerald-500",
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  rejected: {
    dot: "bg-rose-500",
    pill: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status].pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_STYLES[status].dot)} />
      {t(`tracker.status.${status}`)}
    </span>
  );
}

/**
 * Bookmark + application status in one control. Untracked: a bookmark button
 * that saves the company ("saved"). Tracked: the current status pill, opening a
 * menu to move it along the pipeline or remove it. Guests get the sign-in modal.
 */
export function CompanyStatusMenu({
  companyId,
  size = "sm",
  className,
}: {
  companyId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation();
  const { user, openAuth } = useAuth();
  const { get, setStatus } = useCompanyTracker();
  const tracked = get(companyId);

  const base = cn(
    "relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    size === "sm" ? "h-7 px-2 text-[11px]" : size === "md" ? "h-9 px-3 text-sm" : "h-9 justify-center px-2.5 text-sm",
    className,
  );

  if (!tracked) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!user) return openAuth();
          void setStatus(companyId, "saved");
        }}
        aria-label={user ? t("tracker.save") : t("card.signInToSave")}
        title={user ? t("tracker.save") : t("card.signInToSave")}
        className={cn(
          base,
          "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
      >
        <Bookmark className={size === "sm" ? "size-3.5" : "size-4"} />
        {size !== "sm" && <span className="truncate">{t("tracker.save")}</span>}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={t("tracker.changeStatus")}
          className={cn(base, STATUS_STYLES[tracked.status].pill)}
        >
          <BookmarkCheck className={cn("shrink-0", size === "sm" ? "size-3.5" : "size-4")} />
          <span className="truncate">{t(`tracker.status.${tracked.status}`)}</span>
          <ChevronDown className="size-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-52"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("tracker.statusLabel")}
        </DropdownMenuLabel>
        {APPLICATION_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => void setStatus(companyId, s)}
            className="justify-between"
          >
            <span className="inline-flex items-center gap-2">
              <span className={cn("size-2 rounded-full", STATUS_STYLES[s].dot)} />
              {t(`tracker.status.${s}`)}
            </span>
            {tracked.status === s && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void setStatus(companyId, null)}
          className="whitespace-nowrap"
        >
          <Trash2 className="size-4" />
          {t("tracker.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
