"use client";

import { useClickCounts } from "@/components/click-counts-provider";
import { useFavoriteCounts } from "@/components/favorite-counts-provider";
import { Pagination } from "@/components/pagination";
import { ResourceCard } from "@/components/resource-card";
import { SubmitCta } from "@/components/submit-cta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createResourceSearch } from "@/lib/resource-search";
import type { Category, Resource, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Sort =
  | "featured"
  | "popular"
  | "favorites"
  | "name"
  | "name-desc"
  | "recent";

const PRICING_VALUES = ["free", "freemium", "paid"] as const;
const LANG_VALUES = ["en", "tr"] as const;

export function BrowseClient({
  resources,
  categories,
  tags,
  basePath = "/",
  intro,
}: {
  resources: Resource[];
  categories: Category[];
  tags: Tag[];
  /** Path the filter state syncs to (so the homepage stays on "/"). */
  basePath?: string;
  /** Optional intro node rendered above the search bar (used on the homepage). */
  intro?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { get: getClicks } = useClickCounts();
  const { get: getFavorites } = useFavoriteCounts();
  const router = useRouter();
  const params = useSearchParams();

  const PRICING = PRICING_VALUES.map((value) => ({
    value,
    label: t(`pricing.${value}`),
  }));
  const LANGS = LANG_VALUES.map((value) => ({
    value,
    label: t(`languages.${value}`),
  }));

  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState(params.get("category") ?? "");
  const [activeTags, setActiveTags] = useState<string[]>(
    params.get("tags")?.split(",").filter(Boolean) ?? [],
  );
  const [lang, setLang] = useState(params.get("lang") ?? "");
  const [pricing, setPricing] = useState(params.get("pricing") ?? "");
  const [sort, setSort] = useState<Sort>(
    (params.get("sort") as Sort) ?? "featured",
  );
  const [showFilters, setShowFilters] = useState(false);

  // Pagination — 90 per page on desktop (30×3), 30 on mobile.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(90);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setPageSize(mq.matches ? 90 : 30);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Keep the URL in sync so filtered views are shareable.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (cat) sp.set("category", cat);
    if (activeTags.length) sp.set("tags", activeTags.join(","));
    if (lang) sp.set("lang", lang);
    if (pricing) sp.set("pricing", pricing);
    if (sort !== "featured") sp.set("sort", sort);
    const qs = sp.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }, [q, cat, activeTags, lang, pricing, sort, router, basePath]);

  const search = useMemo(() => createResourceSearch(resources), [resources]);

  // Everything except the tag filter — the base set the tag facet counts and
  // the final result both build on. Keeping it separate lets tag counts reflect
  // the *other* active filters (category/pricing/language/search).
  const baseFiltered = useMemo(() => {
    let list = q.trim() ? search(q) : [...resources];
    if (cat)
      list = list.filter((r) => r.categories?.some((c) => c.slug === cat));
    if (lang) list = list.filter((r) => r.language?.includes(lang));
    if (pricing) list = list.filter((r) => (r.pricing ?? "free") === pricing);
    return list;
  }, [q, cat, lang, pricing, search, resources]);

  const filtered = useMemo(() => {
    // Tags are OR'd: a resource matches if it carries ANY selected tag, so
    // adding tags broadens the result set rather than narrowing it to nothing.
    const list = activeTags.length
      ? baseFiltered.filter((r) =>
        activeTags.some((t) => r.tags?.some((rt) => rt.slug === t)),
      )
      : [...baseFiltered];

    if (!q.trim()) {
      if (sort === "name")
        list.sort((a, b) => a.name.localeCompare(b.name));
      else if (sort === "name-desc")
        list.sort((a, b) => b.name.localeCompare(a.name));
      else if (sort === "recent")
        list.sort((a, b) =>
          (b.addedAt ?? "").localeCompare(a.addedAt ?? ""),
        );
      else if (sort === "popular")
        list.sort((a, b) => getClicks(b._id) - getClicks(a._id));
      else if (sort === "favorites")
        list.sort((a, b) => getFavorites(b._id) - getFavorites(a._id));
      else
        list.sort(
          (a, b) => Number(b.featured ?? 0) - Number(a.featured ?? 0),
        );
    }
    return list;
  }, [baseFiltered, activeTags, q, sort, getClicks, getFavorites]);

  // How many resources each tag would add, given the other active filters.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of baseFiltered) {
      for (const tg of r.tags ?? []) {
        counts.set(tg.slug, (counts.get(tg.slug) ?? 0) + 1);
      }
    }
    return counts;
  }, [baseFiltered]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [q, cat, activeTags, lang, pricing, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Anchor at the top of the results so page changes always scroll there,
  // regardless of how page heights differ (window-top scroll was unreliable).
  const resultsRef = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    setPage(p);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const topCategories = categories
    .filter((c) => !c.parentSlug)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const subCategories = categories.filter((c) => c.parentSlug);
  // Rank tags by their count *within the current filters* so the most relevant
  // ones surface; always keep active tags so they stay toggleable.
  const popularTags = [...tags]
    .sort(
      (a, b) =>
        (tagCounts.get(b.slug) ?? 0) - (tagCounts.get(a.slug) ?? 0) ||
        b.count - a.count,
    )
    .filter(
      (tag) =>
        (tagCounts.get(tag.slug) ?? 0) > 0 || activeTags.includes(tag.slug),
    )
    .slice(0, 24);

  const hasFilters =
    cat || activeTags.length || lang || pricing || q.trim();

  const reset = () => {
    setQ("");
    setCat("");
    setActiveTags([]);
    setLang("");
    setPricing("");
    setSort("featured");
  };

  const toggleTag = (slug: string) =>
    setActiveTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );

  return (
    <div className="mx-auto max-w-4xl">
      {intro ?? (
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("browse.heading")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("browse.summary", {
              resources: resources.length,
              categories: topCategories.length,
            })}
          </p>
        </div>
      )}

      {/* Search + sort bar — floating island that docks under the header */}
      <div className="sticky top-[86px] z-20 mb-6 rounded-b-xl bg-background">
        <div className="rounded-xl border border-border/70 bg-background/95 p-3 shadow-md shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("browse.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters((s) => !s)}
              className={cn(showFilters && "border-primary text-primary")}
            >
              <SlidersHorizontal className="size-4" />
              {t("browse.filters")}
            </Button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="cursor-pointer rounded-md border border-border bg-background px-3 text-sm"
              aria-label={t("browse.sort.featured")}
            >
              <option value="featured">{t("browse.sort.featured")}</option>
              <option value="popular">{t("browse.sort.popular")}</option>
              <option value="favorites">{t("browse.sort.favorites")}</option>
              <option value="name">{t("browse.sort.name")}</option>
              <option value="name-desc">{t("browse.sort.nameDesc")}</option>
              <option value="recent">{t("browse.sort.recent")}</option>
            </select>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4">
              <Facet
                label={t("browse.facet.category")}
                options={[
                  ...topCategories.map((c) => ({ value: c.slug, label: c.title })),
                  ...subCategories.map((c) => ({
                    value: c.slug,
                    label: `↳ ${c.title}`,
                  })),
                ]}
                value={cat}
                onChange={(v) => setCat(v === cat ? "" : v)}
              />
              <Facet
                label={t("browse.facet.pricing")}
                options={PRICING}
                value={pricing}
                onChange={(v) => setPricing(v === pricing ? "" : v)}
              />
              <Facet
                label={t("browse.facet.language")}
                options={LANGS}
                value={lang}
                onChange={(v) => setLang(v === lang ? "" : v)}
              />
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {t("browse.facet.tags")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.map((tag) => {
                    const active = activeTags.includes(tag.slug);
                    // Count reflects the other active filters (popularTags has
                    // already dropped tags that would yield nothing).
                    const count = tagCounts.get(tag.slug) ?? 0;
                    return (
                      <button
                        key={tag._id}
                        onClick={() => toggleTag(tag.slug)}
                        aria-pressed={active}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {tag.title}
                        <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {hasFilters && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{t("browse.results", { count: filtered.length })}</span>
              <Button variant="ghost" size="sm" onClick={reset} className="h-7">
                <X className="size-3.5" /> {t("browse.clear")}
              </Button>
              {activeTags.map((slug) => (
                <Badge
                  key={slug}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleTag(slug)}
                >
                  {tags.find((x) => x.slug === slug)?.title ?? slug} ×
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div ref={resultsRef} className="scroll-mt-28" />
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {t("browse.empty")}
          <SubmitCta variant="compact" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((r) => (
              <ResourceCard key={r._id} resource={r} />
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
              pageLabel={t("browse.page", {
                page: currentPage,
                total: totalPages,
              })}
            />
          )}

          {/* Encourage contribution after the results. */}
          <SubmitCta variant="band" />
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
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
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

