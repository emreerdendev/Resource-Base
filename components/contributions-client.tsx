"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";
import { NavLink as Link } from "@/components/nav-link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { initial } from "@/lib/initial";
import type { ContributorEntry } from "@/lib/types";
import { profilePath } from "@/lib/username";

/**
 * Everyone who has contributed — resources, companies, fixes and edits, CVs —
 * most contributions first, each linking to their profile. Loaded from the
 * edge-cached /api/contributions.
 */
export function ContributionsClient() {
  const { t } = useTranslation();
  const [list, setList] = useState<ContributorEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    fetch("/api/contributions")
      .then((r) => (r.ok ? (r.json() as Promise<ContributorEntry[]>) : Promise.reject(r.status)))
      .then(setList)
      .catch(() => setFailed(true));
  };
  // Loads from the API once; state is set when it answers.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={Users} title={t("contributions.title")} description={t("contributions.subtitle")} />

      {failed ? (
        <EmptyState
          icon={Users}
          title={t("contributions.error")}
          action={
            <Button variant="outline" size="sm" onClick={load}>
              {t("notFound.retry")}
            </Button>
          }
        />
      ) : list === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title={t("contributions.empty")} />
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => {
            const parts = [
              c.resources && t("contributions.resources", { count: c.resources }),
              c.companies && t("contributions.companies", { count: c.companies }),
              c.edits && t("contributions.edits", { count: c.edits }),
              c.cvs && t("contributions.cv"),
            ].filter(Boolean);
            return (
              <li key={c.username}>
                <Link
                  href={profilePath(c.username)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted font-medium">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                    ) : (
                      initial(c.full_name || c.username)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.full_name || `@${c.username}`}</span>
                    {c.full_name && (
                      <span className="block truncate text-xs text-muted-foreground">@{c.username}</span>
                    )}
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{parts.join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-semibold tabular-nums">{c.total}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {t("contributions.total", { count: c.total })}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
