"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Download, NotebookPen, Search, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyModal } from "@/components/company-modal";
import { CompanyStatusMenu, STATUS_STYLES, confirmRemove } from "@/components/company-status-menu";
import { useConfirm } from "@/components/confirm-dialog";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { TrackerSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortSelect } from "@/components/ui/sort-select";
import type { TrackedCompany } from "@/lib/company-actions";
import { createCompanySearch } from "@/lib/company-search";
import { toCsv } from "@/lib/csv";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/company-taxonomy";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

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

type SortKey = "recent" | "name" | "status";
const SORTS: SortKey[] = ["recent", "name", "status"];
/** "Status" sort: furthest along first, closed ones last. */
const STATUS_ORDER: ApplicationStatus[] = ["offer", "interview", "applied", "saved", "rejected"];

/**
 * The user's application pipeline: every saved company with its status and
 * note, filterable by status, searchable, sortable and exportable. Entries of
 * companies since removed from the directory are listed separately so their
 * notes aren't silently lost.
 */
export function ApplicationsTracker({ companies }: { companies: Company[] }) {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { items, loading } = useCompanyTracker();
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const byId = useMemo(() => new Map(companies.map((c) => [c._id, c])), [companies]);
  const rows = useMemo(() => items.filter((x) => byId.has(x.companyId)), [items, byId]);
  const removed = useMemo(() => items.filter((x) => !byId.has(x.companyId)), [items, byId]);
  const counts = Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
  ) as Record<ApplicationStatus, number>;

  // Same Turkish-insensitive search as the directory, over tracked companies.
  const search = useMemo(
    () => createCompanySearch(rows.map((r) => byId.get(r.companyId)!)),
    [rows, byId],
  );
  const visible = useMemo(() => {
    const matched = q.trim() ? new Set(search(q).map((c) => c._id)) : null;
    const list = rows
      .filter((r) => !status || r.status === status)
      .filter((r) => !matched || matched.has(r.companyId));
    const name = (r: TrackedCompany) => byId.get(r.companyId)!.name;
    if (sort === "name")
      return [...list].sort((a, b) => name(a).localeCompare(name(b), i18n.language));
    if (sort === "status")
      return [...list].sort(
        (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
      );
    return list; // server order: most recently updated first
  }, [rows, status, q, search, sort, byId, i18n.language]);

  function exportCsv() {
    const csv = toCsv([
      [
        t("tracker.csv.company"),
        t("tracker.csv.status"),
        t("tracker.csv.note"),
        t("tracker.csv.updated"),
        t("suggest.website"),
        t("suggest.career"),
        "LinkedIn",
        t("suggest.emails"),
      ],
      ...rows.map((r) => {
        const c = byId.get(r.companyId)!;
        return [
          c.name,
          t(`tracker.status.${r.status}`),
          r.note,
          r.updatedAt.slice(0, 10),
          c.website,
          c.careerLinks[0],
          c.linkedin,
          c.emails.join(" "),
        ];
      }),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authLoading && !user) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title={t("tracker.signInPrompt")}
        action={<Button onClick={() => openAuth()}>{t("header.signIn")}</Button>}
      />
    );
  }
  if (loading || authLoading) {
    return <TrackerSkeleton />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BriefcaseBusiness}
        title={t("tracker.empty")}
        hint={t("tracker.import.emptyHint")}
        action={
          <Button asChild>
            <Link href="/companies">{t("tracker.browse")}</Link>
          </Button>
        }
      />
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

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("tracker.searchPlaceholder")}
            aria-label={t("tracker.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <SortSelect
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t("tracker.sort.label")}
        >
          {SORTS.map((k) => (
            <option key={k} value={k}>
              {t(`tracker.sort.${k}`)}
            </option>
          ))}
        </SortSelect>
        {rows.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> {t("tracker.exportCsv")}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("tracker.noneInStatus")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((r) => (
            <Row key={r.companyId} company={byId.get(r.companyId)!} tracked={r} />
          ))}
        </ul>
      )}

      {removed.length > 0 && <RemovedCompanies items={removed} />}
    </div>
  );
}

/** Tracked companies no longer in the directory: status + note, removable. */
function RemovedCompanies({ items }: { items: TrackedCompany[] }) {
  const { t } = useTranslation();
  const { setStatus } = useCompanyTracker();
  const { confirm, dialog } = useConfirm();
  // The company document is gone, so its id ("company-acme-inc") is the only
  // name left.
  const label = (id: string) =>
    id.replace(/^company-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <details className="mt-4 rounded-xl border border-dashed border-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        {t("tracker.removedTitle", { count: items.length })}
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">{t("tracker.removedHint")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.companyId} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{label(r.companyId)}</p>
              <p className="text-xs text-muted-foreground">
                {t(`tracker.status.${r.status}`)}
                {r.note && ` · ${r.note}`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("tracker.remove")}
              title={t("tracker.remove")}
              onClick={async () => {
                if (await confirmRemove(confirm, t, r.note)) void setStatus(r.companyId, null);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {dialog}
    </details>
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
