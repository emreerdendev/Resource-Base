"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink as Link } from "@/components/nav-link";
import { Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CvCard } from "@/components/cv-card";
import { useCvLikes } from "@/components/cv-likes-provider";
import { CvsIntro } from "@/components/cvs-intro";
import { Facet } from "@/components/facet";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ResourceGridSkeleton } from "@/components/skeletons";
import { SubmitCta } from "@/components/submit-cta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UrlParams } from "@/components/url-params";
import { SortSelect } from "@/components/ui/sort-select";
import { CV_FIELDS, CV_LANGUAGES, CV_SENIORITIES } from "@/lib/cv-taxonomy";
import { loadCvListing } from "@/lib/cv-listing";
import { createSearch } from "@/lib/search";
import type { CvListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

type Sort = "newest" | "popular";
type FacetKey = "field" | "seniority" | "language" | "tech";
type Selection = Record<FacetKey, string[]>;

const FACETS: FacetKey[] = ["field", "seniority", "language", "tech"];
const EMPTY: Selection = { field: [], seniority: [], language: [], tech: [] };
const PAGE_SIZE = 30;
const TOP_TECH = 15;

const matches = (cv: CvListing, key: FacetKey, v: string) =>
  key === "tech" ? cv.technologies.includes(v) : cv[key] === v;

/**
 * The CV directory (`mode="all"`), laid out like Resources and Companies —
 * centered intro, a sticky search/filter bar, the grid, then a "share yours"
 * band — and the signed-in user's liked CVs (`mode="liked"`). The listing
 * comes from the edge-cached /api/cvs, so the page itself stays static.
 */
export function CvsClient({ mode }: { mode: "all" | "liked" }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const likes = useCvLikes();
  const [all, setAll] = useState<CvListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Selection>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  // Shareable URLs: ?q=, ?sort= and the facets (?field=…&tech=…) — the ⌘K
  // palette links CVs with ?q=. Read after hydration, written with the
  // History API (no server request), like Resources and Companies.
  const urlRead = useRef(false);
  const applyParams = useCallback((p: URLSearchParams) => {
    urlRead.current = true;
    setQ(p.get("q")?.slice(0, 100) ?? "");
    const s = p.get("sort");
    setSort(s === "popular" ? "popular" : "newest");
    const next = Object.fromEntries(
      FACETS.map((k) => [k, [...new Set(p.getAll(k).filter(Boolean))].slice(0, 20)]),
    ) as Selection;
    setSelected((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    if (FACETS.some((k) => next[k].length > 0)) setShowFilters(true);
  }, []);
  useEffect(() => {
    if (!urlRead.current) return; // never wipe a shared link's filters
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sort !== "newest") sp.set("sort", sort);
    for (const k of FACETS) for (const v of selected[k]) sp.append(k, v);
    const qs = sp.toString();
    const path = window.location.pathname;
    const next = qs ? `${path}?${qs}` : path;
    if (next !== path + window.location.search) window.history.replaceState(window.history.state, "", next);
  }, [q, sort, selected]);
  // The page belongs to one set of filters and sort: changing either starts at
  // page 1 (derived, no reset effect).
  const filterKey = JSON.stringify([q, selected, sort]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = (p: number) => setPaging({ key: filterKey, page: p });
  const resultsRef = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    setPage(p);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  useEffect(() => {
    let active = true;
    loadCvListing()
      .then((rows) => active && setAll(rows))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const base = useMemo(() => {
    if (!all) return [];
    return mode === "liked" ? all.filter((cv) => likes.liked(cv.id)) : all;
  }, [all, mode, likes]);

  const search = useMemo(
    () =>
      createSearch(base, (cv) => cv.title, [
        { get: (cv) => cv.technologies },
        { get: (cv) => [t(`cvs.field.${cv.field}`)] },
        { get: (cv) => (cv.summary ? [cv.summary] : []), match: "words" },
      ]),
    [base, t],
  );

  // The most common technologies are offered as filter chips.
  const topTech = useMemo(() => {
    const n = new Map<string, number>();
    for (const cv of base) for (const x of cv.technologies) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).slice(0, TOP_TECH).map(([x]) => x);
  }, [base]);

  const options: Record<FacetKey, { value: string; label: string }[]> = {
    field: CV_FIELDS.map((v) => ({ value: v, label: t(`cvs.field.${v}`) })),
    seniority: CV_SENIORITIES.map((v) => ({ value: v, label: t(`cvs.seniority.${v}`) })),
    language: CV_LANGUAGES.map((v) => ({ value: v, label: t(`cvs.language.${v}`) })),
    tech: topTech.map((v) => ({ value: v, label: v })),
  };
  const labels: Record<FacetKey, string> = {
    field: t("cvs.filter.field"),
    seniority: t("cvs.filter.seniority"),
    language: t("cvs.filter.language"),
    tech: t("cvs.filter.technology"),
  };

  const searched = useMemo(() => (q.trim() ? search(q) : base), [q, search, base]);
  // Within a facet any selected value matches (OR); across facets all must (AND).
  const passes = (cv: CvListing, skip?: FacetKey) =>
    FACETS.every(
      (key) => key === skip || !selected[key].length || selected[key].some((v) => matches(cv, key, v)),
    );

  const filtered = useMemo(() => {
    const list = searched.filter((cv) => passes(cv));
    if (sort === "popular" && !q.trim())
      return [...list].sort((a, b) => likes.count(b.id, b.likeCount) - likes.count(a.id, a.likeCount));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched, selected, sort, q, likes]);

  /** How many results each option of `key` would give with the other filters kept. */
  const countsFor = (key: FacetKey) => {
    const pool = searched.filter((cv) => passes(cv, key));
    return new Map(options[key].map((o) => [o.value, pool.filter((cv) => matches(cv, key, o.value)).length]));
  };

  const toggle = (key: FacetKey, v: string) => {
    setSelected((s) => ({
      ...s,
      [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
    }));
    setPage(1);
  };
  const active = FACETS.flatMap((key) =>
    selected[key].map((v) => ({
      id: `${key}:${v}`,
      label: options[key].find((o) => o.value === v)?.label ?? v,
      remove: () => toggle(key, v),
    })),
  );
  const hasFilters = active.length > 0 || Boolean(q.trim());
  const reset = () => {
    setQ("");
    setSelected(EMPTY);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const loading = !all || (mode === "liked" && likes.loading);

  const header =
    mode === "liked" ? (
      <PageHeader icon={Heart} title={t("cvs.liked.title")} description={t("cvs.liked.subtitle")} />
    ) : (
      <CvsIntro count={all ? all.length : null} />
    );

  if (mode === "liked" && !authLoading && !user) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <EmptyState
          icon={Heart}
          title={t("cvs.liked.signInPrompt")}
          action={<Button onClick={() => openAuth()}>{t("header.signIn")}</Button>}
        />
      </div>
    );
  }

  // Liked CVs: like Favorites and My Applications — while loading a skeleton,
  // with nothing liked a single empty box; search, filters and sort only once
  // there is something to search.
  if (mode === "liked" && (loading || base.length === 0)) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        {loading ? (
          <ResourceGridSkeleton count={6} columns={2} />
        ) : (
          <EmptyState
            icon={Heart}
            title={t("cvs.liked.empty")}
            action={
              <Button asChild>
                <Link href="/cvs">{t("cvs.browse")}</Link>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <UrlParams onChange={applyParams} />
      {header}

      {/* Search bar — floating island that docks under the header */}
      <div className="sticky top-[88px] z-20 mb-6 rounded-b-xl bg-background">
        <div className="rounded-xl border border-border/70 bg-background/95 p-3 shadow-md shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
          {/* Phones: the search gets its own row, the controls share the next. */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <div className="relative w-full sm:w-auto sm:flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={t("cvs.searchPlaceholder")}
                aria-label={t("cvs.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters((s) => !s)}
              className={cn("flex-1 sm:flex-none", showFilters && "border-primary text-primary")}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="size-4" />
              {t("browse.filters")}
              {active.length > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {active.length}
                </span>
              )}
            </Button>
            <SortSelect
              className="flex-1 sm:flex-none"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label={t("cvs.sort.label")}
            >
              <option value="newest">{t("cvs.sort.newest")}</option>
              <option value="popular">{t("cvs.sort.popular")}</option>
            </SortSelect>
          </div>

          {showFilters && (
            <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-4">
              {FACETS.map((key) =>
                options[key].length > 0 ? (
                  <Facet
                    key={key}
                    label={labels[key]}
                    options={options[key]}
                    counts={countsFor(key)}
                    selected={selected[key]}
                    onToggle={(v) => toggle(key, v)}
                  />
                ) : null,
              )}
            </div>
          )}

          {hasFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t("browse.results", { count: filtered.length })}</span>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7">
                <X className="size-3.5" /> {t("browse.clear")}
              </Button>
              {active.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={a.remove}
                  aria-label={t("companies.removeFilter", { filter: a.label })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/70"
                >
                  {a.label}
                  <X className="size-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {failed ? (
        <div className="py-20 text-center text-muted-foreground">
          <p>{t("cvs.loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setFailed(false);
              loadCvListing()
                .then(setAll)
                .catch(() => setFailed(true));
            }}
          >
            {t("notFound.retry")}
          </Button>
        </div>
      ) : loading ? (
        <ResourceGridSkeleton count={8} columns={2} />
      ) : base.length === 0 ? (
        // Nothing shared yet (an empty Liked CVs list returned above).
        <div className="py-20 text-center text-muted-foreground">
          {t("cvs.emptyAll")}
          <SubmitCta variant="compact" kind="cv" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {t("cvs.empty")}
          {mode === "all" && <SubmitCta variant="compact" kind="cv" />}
        </div>
      ) : (
        <>
          <div ref={resultsRef} className="scroll-mt-28" />
          {/* Two per row: CV titles need the width. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {shown.map((cv) => (
              <CvCard key={cv.id} cv={cv} pool={all ?? undefined} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              page={current}
              totalPages={totalPages}
              onChange={goToPage}
              prevLabel={t("browse.prev")}
              nextLabel={t("browse.next")}
              firstLabel={t("browse.first")}
              pageLabel={t("browse.page", { page: current, total: totalPages })}
            />
          )}
        </>
      )}

      {mode === "all" && !loading && base.length > 0 && <SubmitCta variant="band" kind="cv" />}

      {mode === "all" && (
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-xs leading-relaxed text-muted-foreground">
          {t("cvs.disclaimer")}
        </p>
      )}
    </div>
  );
}
