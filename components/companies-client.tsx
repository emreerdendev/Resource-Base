"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Shuffle, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CompanyCard } from "@/components/company-card";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { Pagination } from "@/components/pagination";
import { SubmitCta } from "@/components/submit-cta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CITIES,
  SECTORS,
  WORK_MODELS,
  type City,
  type Sector,
  type WorkModel,
} from "@/lib/company-taxonomy";
import { createCompanySearch } from "@/lib/company-search";
import { shuffle } from "@/lib/company-utils";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mine = "" | "tracked" | "untracked";
type FacetKey = "city" | "work" | "channel" | "sector";
type Selection = Record<FacetKey, string[]>;

/** Channels that map to concrete links/addresses on the listing. */
const FILTER_CHANNELS = ["email", "career", "linkedin"] as const;

/** Location option matching every company with a free-text place. */
const OTHER_LOCATIONS = "other";
/** Free-text places shown as their own chip (the rest are under "Other"). */
const TOP_OTHER_PLACES = 8;

const FACETS: FacetKey[] = ["city", "work", "channel", "sector"];

/** Does company `c` match one selected value of facet `key`? */
function matches(c: Company, key: FacetKey, v: string): boolean {
  switch (key) {
    case "city":
      return v === OTHER_LOCATIONS
        ? c.otherLocations.length > 0
        : c.cities.includes(v as City) || c.otherLocations.includes(v);
    case "work":
      return c.workModels.includes(v as WorkModel);
    case "channel":
      return v === "email"
        ? c.emails.length > 0
        : v === "career"
          ? c.careerLinks.length > 0
          : Boolean(c.linkedin);
    case "sector":
      return c.sectors.includes(v as Sector);
  }
}

/** Values within a facet are OR'd; facets are AND'd together. */
const matchesFacet = (c: Company, key: FacetKey, values: string[]) =>
  values.length === 0 || values.some((v) => matches(c, key, v));

/** Read a facet from the URL (?city=a&city=b), dropping unknown values. */
function readFacet(params: URLSearchParams, key: FacetKey): string[] {
  const all = params.getAll(key).filter(Boolean);
  const known: Record<FacetKey, readonly string[] | null> = {
    city: null, // quick-pick slugs, "other" or any free-text place
    work: WORK_MODELS,
    channel: FILTER_CHANNELS,
    sector: SECTORS,
  };
  const allowed = known[key];
  return [...new Set(allowed ? all.filter((v) => allowed.includes(v)) : all)];
}

/**
 * The company directory. Arrives already shuffled from the server (a fresh
 * order on every visit — there's deliberately no ranking), then searched and
 * filtered entirely client-side; the set is small enough to stay instant.
 */
export function CompaniesClient({
  companies: initial,
  intro,
}: {
  companies: Company[];
  intro?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const params = useSearchParams();
  const { user } = useAuth();
  const { get: getTracked } = useCompanyTracker();

  const [companies, setCompanies] = useState(initial);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selected, setSelected] = useState<Selection>(() => ({
    city: readFacet(params, "city"),
    work: readFacet(params, "work"),
    channel: readFacet(params, "channel"),
    sector: readFacet(params, "sector"),
  }));
  const [mineParam, setMine] = useState<Mine>(() => {
    const m = params.get("mine");
    return m === "tracked" || m === "untracked" ? m : "";
  });
  // "My tracker" only means something when signed in.
  const mine: Mine = user ? mineParam : "";
  const [showFilters, setShowFilters] = useState(
    () => FACETS.some((k) => params.getAll(k).length > 0) || Boolean(params.get("mine")),
  );

  // 60 per page on desktop (20×3), 30 on mobile.
  const [pageSize, setPageSize] = useState(60);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setPageSize(mq.matches ? 60 : 30);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Shareable, filterable URLs (the order itself is never persisted). Uses the
  // History API rather than router.replace: the page renders per request, so a
  // router navigation would cost a server render on every keystroke.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    for (const k of FACETS) for (const v of selected[k]) sp.append(k, v);
    if (mineParam) sp.set("mine", mineParam);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/companies?${qs}` : "/companies");
  }, [q, selected, mineParam]);

  const search = useMemo(() => createCompanySearch(companies), [companies]);

  // Search + "my tracker" first; facets are applied on top of this base.
  const searched = useMemo(() => {
    const list = q.trim() ? search(q) : companies;
    return mine ? list.filter((c) => Boolean(getTracked(c._id)) === (mine === "tracked")) : list;
  }, [q, search, companies, mine, getTracked]);

  const filtered = useMemo(
    () => searched.filter((c) => FACETS.every((k) => matchesFacet(c, k, selected[k]))),
    [searched, selected],
  );

  /**
   * Result count per option, given everything else that's active (search,
   * tracker and the OTHER facets) — so a chip's number is what you'd get by
   * adding it, and chips that would yield nothing can be disabled.
   */
  const countsFor = (key: FacetKey, values: string[]) => {
    const base = searched.filter((c) =>
      FACETS.every((k) => k === key || matchesFacet(c, k, selected[k])),
    );
    return new Map(values.map((v) => [v, base.filter((c) => matches(c, key, v)).length]));
  };

  // Locations: every quick-pick city (fixed, same list as the suggestion
  // form), then the most common free-text places, then "Other locations" for
  // all of them — so the facet scales without a fixed world list.
  const locationOptions = useMemo(() => {
    const freq = new Map<string, number>();
    for (const c of companies)
      for (const o of c.otherLocations) freq.set(o, (freq.get(o) ?? 0) + 1);
    const top = [...freq]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_OTHER_PLACES)
      .map(([v]) => v);
    // Keep a place picked from a shared link visible even if it isn't top.
    const pickedOthers = selected.city.filter(
      (v) => v !== OTHER_LOCATIONS && !(CITIES as readonly string[]).includes(v) && !top.includes(v),
    );
    return [
      ...CITIES.map((v) => ({ value: v, label: t(`companies.city.${v}`) })),
      ...[...top, ...pickedOthers].map((v) => ({ value: v, label: v })),
      ...(freq.size > 0 || selected.city.includes(OTHER_LOCATIONS)
        ? [{ value: OTHER_LOCATIONS, label: t("companies.otherLocations") }]
        : []),
    ];
  }, [companies, selected.city, t]);

  // Sectors are an open-ended taxonomy: offer the ones in use (plus any picked).
  const sectorOptions = SECTORS.filter(
    (s) => selected.sector.includes(s) || companies.some((c) => c.sectors.includes(s)),
  ).map((v) => ({ value: v, label: t(`companies.sector.${v}`) }));

  const facetOptions: Record<FacetKey, { value: string; label: string }[]> = {
    city: locationOptions,
    work: WORK_MODELS.map((v) => ({ value: v, label: t(`companies.workModel.${v}`) })),
    channel: FILTER_CHANNELS.map((v) => ({ value: v, label: t(`companies.channel.${v}`) })),
    sector: sectorOptions,
  };
  const facetLabels: Record<FacetKey, string> = {
    city: t("companies.facet.city"),
    work: t("companies.facet.workModel"),
    channel: t("companies.facet.channel"),
    sector: t("companies.facet.sector"),
  };

  // Back to page 1 whenever the result set changes (state keyed by filters,
  // so no reset effect is needed).
  const filterKey = JSON.stringify([q, selected, mine]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resultsRef = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    setPage(p);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const toggleValue = (key: FacetKey, v: string) =>
    setSelected((s) => ({
      ...s,
      [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
    }));

  // Active selections as removable chips (visible even with the panel closed).
  const active = [
    ...FACETS.flatMap((key) =>
      selected[key].map((v) => ({
        id: `${key}:${v}`,
        label: facetOptions[key].find((o) => o.value === v)?.label ?? v,
        remove: () => toggleValue(key, v),
      })),
    ),
    ...(mine
      ? [{ id: "mine", label: t(`companies.mine.${mine}`), remove: () => setMine("") }]
      : []),
  ];
  const filterCount = active.length;
  const hasFilters = filterCount > 0 || q.trim();
  const reset = () => {
    setQ("");
    setSelected({ city: [], work: [], channel: [], sector: [] });
    setMine("");
  };

  return (
    <div className="mx-auto max-w-4xl">
      {intro}

      {/* Search bar — floating island that docks under the header */}
      <div className="sticky top-[86px] z-20 mb-6 rounded-b-xl bg-background">
        <div className="rounded-xl border border-border/70 bg-background/95 p-3 shadow-md shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("companies.searchPlaceholder")}
                aria-label={t("companies.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters((s) => !s)}
              className={cn(showFilters && "border-primary text-primary")}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">{t("browse.filters")}</span>
              {filterCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCompanies((c) => shuffle(c))}
              aria-label={t("companies.shuffle")}
              title={t("companies.shuffle")}
            >
              <Shuffle className="size-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-card p-4">
              {FACETS.map((key) =>
                facetOptions[key].length > 0 ? (
                  <Facet
                    key={key}
                    label={facetLabels[key]}
                    options={facetOptions[key]}
                    counts={countsFor(
                      key,
                      facetOptions[key].map((o) => o.value),
                    )}
                    selected={selected[key]}
                    onToggle={(v) => toggleValue(key, v)}
                  />
                ) : null,
              )}
              {user && (
                <Facet
                  label={t("companies.facet.mine")}
                  options={[
                    { value: "tracked", label: t("companies.mine.tracked") },
                    { value: "untracked", label: t("companies.mine.untracked") },
                  ]}
                  selected={mine ? [mine] : []}
                  onToggle={(v) => setMine(v === mine ? "" : (v as Mine))}
                />
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

      <div ref={resultsRef} className="scroll-mt-28" />
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {t("companies.empty")}
          <SubmitCta variant="compact" kind="company" name={q} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((c) => (
              <CompanyCard key={c._id} company={c} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={goToPage}
              prevLabel={t("browse.prev")}
              nextLabel={t("browse.next")}
              firstLabel={t("browse.first")}
              pageLabel={t("browse.page", { page: currentPage, total: totalPages })}
            />
          )}

          <SubmitCta variant="band" kind="company" />
        </>
      )}
    </div>
  );
}

function Facet({
  label,
  options,
  counts,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  /** Result count per option; options that would yield nothing are disabled. */
  counts?: Map<string, number>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          const count = counts?.get(o.value);
          const empty = count === 0 && !on;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={on}
              disabled={empty}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                on
                  ? "cursor-pointer border-primary bg-primary text-primary-foreground"
                  : empty
                    ? "cursor-not-allowed border-border bg-background opacity-45"
                    : "cursor-pointer border-border bg-background hover:bg-muted",
              )}
            >
              {o.label}
              {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
