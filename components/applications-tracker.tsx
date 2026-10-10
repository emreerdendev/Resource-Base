"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Loader2, NotebookPen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyModal } from "@/components/company-modal";
import { CompanyStatusMenu, STATUS_STYLES } from "@/components/company-status-menu";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrackedCompany } from "@/lib/company-actions";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/company-taxonomy";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({ company, tracked }: { company: Company; tracked: TrackedCompany }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const updated = new Date(tracked.updatedAt).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
  });

  return (
    <li className="relative flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("company.viewDetails", { name: company.name })}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl"
      />
      <CompanyLogo company={company} />
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{company.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          {tracked.note ? (
            <>
              <NotebookPen className="size-3 shrink-0" />
              <span className="truncate">{tracked.note}</span>
            </>
          ) : (
            t("tracker.updated", { date: updated })
          )}
        </p>
      </div>
      <CompanyStatusMenu companyId={company._id} />
      <CompanyModal company={company} open={open} onOpenChange={setOpen} />
    </li>
  );
}

/**
 * The user's application pipeline: every saved company with its status and
 * note, filterable by status. `compact` renders the profile summary (counts +
 * the latest few) with a link to the full /applications page.
 */
export function ApplicationsTracker({
  companies,
  compact = false,
}: {
  companies: Company[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { items, loading } = useCompanyTracker();
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(companies.map((c) => [c._id, c])), [companies]);
  // Companies later hidden/removed from the directory simply drop out.
  const rows = items.filter((x) => byId.has(x.companyId));
  const counts = Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
  ) as Record<ApplicationStatus, number>;

  const needle = q.trim().toLocaleLowerCase();
  const visible = rows
    .filter((r) => !status || r.status === status)
    .filter((r) => !needle || byId.get(r.companyId)!.name.toLocaleLowerCase().includes(needle));
  const shown = compact ? visible.slice(0, 5) : visible;

  if (!authLoading && !user) {
    return (
      <div className="rounded-xl border border-dashed border-border py-20 text-center">
        <p className="text-muted-foreground">{t("tracker.signInPrompt")}</p>
        <Button className="mt-4" onClick={() => openAuth()}>
          {t("header.signIn")}
        </Button>
      </div>
    );
  }
  if (loading || authLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <BriefcaseBusiness className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">{t("tracker.empty")}</p>
        {!compact && (
          <p className="mt-1 text-sm text-muted-foreground">{t("tracker.import.emptyHint")}</p>
        )}
        <Button asChild className="mt-4">
          <Link href="/">{t("tracker.browse")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status pipeline — doubles as the filter. */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatTile
          label={t("tracker.all")}
          count={rows.length}
          active={!status}
          onClick={() => setStatus("")}
        />
        {APPLICATION_STATUSES.map((s) => (
          <StatTile
            key={s}
            label={t(`tracker.status.${s}`)}
            count={counts[s]}
            dot={STATUS_STYLES[s].dot}
            active={status === s}
            onClick={() => setStatus(status === s ? "" : s)}
          />
        ))}
      </div>

      {!compact && (
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("tracker.searchPlaceholder")}
            aria-label={t("tracker.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("tracker.noneInStatus")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => (
            <Row key={r.companyId} company={byId.get(r.companyId)!} tracked={r} />
          ))}
        </ul>
      )}

      {compact && (
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 self-center text-sm font-medium text-primary hover:underline"
        >
          {t("tracker.viewAll", { count: rows.length })} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function StatTile({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
        {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{count}</span>
    </button>
  );
}
