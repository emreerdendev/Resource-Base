"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Fuse from "fuse.js";
import { Search, Shuffle, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CompanyCard } from "@/components/company-card";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  APPLICATION_CHANNELS,
  CITIES,
  SECTORS,
  WORK_MODELS,
} from "@/lib/company-taxonomy";
import { shuffle } from "@/lib/company-utils";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mine = "" | "tracked" | "untracked";

/** Channels a visitor can act on from the listing itself. */
const FILTER_CHANNELS = APPLICATION_CHANNELS.filter((c) => c !== "message");

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
  const [city, setCity] = useState(params.get("city") ?? "");
  const [workModel, setWorkModel] = useState(params.get("work") ?? "");
  const [channel, setChannel] = useState(params.get("channel") ?? "");
  const [sector, setSector] = useState(params.get("sector") ?? "");
  const [mine, setMine] = useState<Mine>((params.get("mine") as Mine) ?? "");
  const [showFilters, setShowFilters] = useState(
    Boolean(params.get("city") || params.get("work") || params.get("channel") || params.get("sector")),
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
  // History API rather than router.replace: "/" renders per request, so a
  // router navigation would cost a server render on every keystroke.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (city) sp.set("city", city);
    if (workModel) sp.set("work", workModel);
    if (channel) sp.set("channel", channel);
    if (sector) sp.set("sector", sector);
    if (mine) sp.set("mine", mine);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  }, [q, city, workModel, channel, sector, mine]);

  const fuse = useMemo(
    () =>
      new Fuse(companies, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "website", weight: 0.1 },
          { name: "emails", weight: 0.1 },
          { name: "clients", weight: 0.1 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [companies],
  );

  const filtered = useMemo(() => {
    let list = q.trim() ? fuse.search(q).map((r) => r.item) : companies;
    if (city) list = list.filter((c) => c.cities.includes(city as never));
    if (workModel) list = list.filter((c) => c.workModels.includes(workModel as never));
    if (sector) list = list.filter((c) => c.sectors.includes(sector as never));
    if (channel)
      list = list.filter((c) =>
        channel === "email"
          ? c.emails.length > 0
          : channel === "career"
            ? c.careerLinks.length > 0
            : channel === "linkedin"
              ? Boolean(c.linkedin)
              : c.channels.includes(channel as never),
      );
    if (mine && user)
      list = list.filter((c) => Boolean(getTracked(c._id)) === (mine === "tracked"));
    return list;
  }, [q, city, workModel, sector, channel, mine, user, fuse, companies, getTracked]);

  // Back to page 1 whenever the result set changes (state keyed by filters,
  // so no reset effect is needed).
  const filterKey = [q, city, workModel, channel, sector, mine].join("|");
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

  const filterCount = [city, workModel, channel, sector, mine].filter(Boolean).length;
  const hasFilters = filterCount > 0 || q.trim();
  const reset = () => {
    setQ("");
    setCity("");
    setWorkModel("");
    setChannel("");
    setSector("");
    setMine("");
  };
  const toggle = (setter: (v: string) => void, current: string) => (v: string) =>
    setter(v === current ? "" : v);

  // Only offer sectors that actually occur, so no chip ever yields nothing.
  const sectors = SECTORS.filter((s) => companies.some((c) => c.sectors.includes(s)));

  return (
    <div className="mx-auto max-w-4xl">
      {intro}

      {/* Search bar — floating island that docks under the header */}
      <div className="sticky top-[86px] z-40 mb-6 rounded-b-xl bg-background">
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
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4">
              <Facet
                label={t("companies.facet.city")}
                options={CITIES.map((v) => ({ value: v, label: t(`companies.city.${v}`) }))}
                value={city}
                onChange={toggle(setCity, city)}
              />
              <Facet
                label={t("companies.facet.workModel")}
                options={WORK_MODELS.filter((v) => v !== "onsite").map((v) => ({
                  value: v,
                  label: t(`companies.workModel.${v}`),
                }))}
                value={workModel}
                onChange={toggle(setWorkModel, workModel)}
              />
              <Facet
                label={t("companies.facet.channel")}
                options={FILTER_CHANNELS.map((v) => ({
                  value: v,
                  label: t(`companies.channel.${v}`),
                }))}
                value={channel}
                onChange={toggle(setChannel, channel)}
              />
              {sectors.length > 0 && (
                <Facet
                  label={t("companies.facet.sector")}
                  options={sectors.map((v) => ({ value: v, label: t(`companies.sector.${v}`) }))}
                  value={sector}
                  onChange={toggle(setSector, sector)}
                />
              )}
              {user && (
                <Facet
                  label={t("companies.facet.mine")}
                  options={[
                    { value: "tracked", label: t("companies.mine.tracked") },
                    { value: "untracked", label: t("companies.mine.untracked") },
                  ]}
                  value={mine}
                  onChange={(v) => setMine(v === mine ? "" : (v as Mine))}
                />
              )}
            </div>
          )}

          {hasFilters && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("browse.results", { count: filtered.length })}</span>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7">
                <X className="size-3.5" /> {t("browse.clear")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-28" />
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">{t("companies.empty")}</div>
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
        </>
      )}
    </div>
  );
}

function Facet({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
