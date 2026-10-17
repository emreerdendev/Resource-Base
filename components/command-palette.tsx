"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Boxes, Building2, FileText, Hash, Search } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { createCompanySearch } from "@/lib/company-search";
import { loadCvListing } from "@/lib/cv-listing";
import { createResourceSearch } from "@/lib/resource-search";
import { createSearch } from "@/lib/search";
import type { CvListing, SearchIndex } from "@/lib/types";
import { trackClick } from "@/lib/track-click";

/** Fired by the header search button to open the palette from anywhere. */
export const OPEN_COMMAND_EVENT = "open-command-palette";

const EMPTY: SearchIndex = { resources: [], companies: [] };

// One fetch per page load, shared by every open; a failure retries next open.
let indexPromise: Promise<SearchIndex> | null = null;
function loadIndex(): Promise<SearchIndex> {
  indexPromise ??= fetch("/api/search-index")
    .then((r) => (r.ok ? (r.json() as Promise<SearchIndex>) : Promise.reject(r.status)))
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}

/**
 * ⌘K search over every resource, company and CV. The dataset is fetched the first
 * time the palette opens rather than shipped with each page.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [cvs, setCvs] = useState<CvListing[]>([]);
  const { resources, companies } = index ?? EMPTY;

  useEffect(() => {
    if (!open || index) return;
    let active = true;
    loadIndex()
      .then((data) => active && setIndex(data))
      .catch(() => {});
    // CVs come from their own edge-cached listing (shared with /cvs).
    loadCvListing()
      .then((rows) => active && setCvs(rows))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, index]);

  // Build the search indexes once (see lib/search.ts for the ranking).
  const searchResources = useMemo(() => createResourceSearch(resources), [resources]);

  const searchCompanies = useMemo(() => createCompanySearch(companies), [companies]);
  const searchCvs = useMemo(
    () =>
      createSearch(cvs, (cv) => cv.title, [
        { get: (cv) => cv.technologies },
        { get: (cv) => [t(`cvs.field.${cv.field}`)] },
      ]),
    [cvs, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  const results = useMemo(() => {
    if (!query.trim())
      return resources.filter((r) => r.featured).slice(0, 8);
    return searchResources(query).slice(0, 12);
  }, [query, searchResources, resources]);

  const companyResults = useMemo(
    () =>
      query.trim() ? searchCompanies(query).slice(0, 6) : [],
    [query, searchCompanies],
  );

  const cvResults = useMemo(
    () => (query.trim() ? searchCvs(query).slice(0, 5) : []),
    [query, searchCvs],
  );

  const go = (href: string, external = false) => {
    setOpen(false);
    setQuery("");
    if (external) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("command.title")}
      description={t("command.description")}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t("command.placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
        {/* The "Go To" group is always there, so cmdk's own empty state would
            never show: say "loading" / "no matches" ourselves. */}
        {!index ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("command.loading")}</p>
        ) : (
          query.trim() &&
          results.length + companyResults.length + cvResults.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("command.empty")}</p>
          )
        )}
        {results.length > 0 && (
        <CommandGroup heading={query ? t("command.results") : t("command.featured")}>
          {results.map((r) => (
            <CommandItem
              key={r._id}
              value={r._id}
              onSelect={() => {
                // Opening a resource counts as a click, as on its card.
                trackClick(r._id);
                go(r.url, true);
              }}
              className="flex items-center gap-2"
            >
              <Search className="size-4 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{r.name}</span>
              {r.categories?.[0] && (
                <span className="text-muted-foreground text-xs">
                  {r.categories[0].title}
                </span>
              )}
              <ArrowUpRight className="size-3.5 opacity-50" />
            </CommandItem>
          ))}
        </CommandGroup>
        )}
        {companyResults.length > 0 && (
          <CommandGroup heading={t("command.companies")}>
            {companyResults.map((c) => (
              <CommandItem
                key={c._id}
                value={c._id}
                onSelect={() => go(`/company/${c.slug}`)}
                className="flex items-center gap-2"
              >
                <Building2 className="size-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {cvResults.length > 0 && (
          <CommandGroup heading={t("nav.cvs")}>
            {cvResults.map((cv) => (
              <CommandItem
                key={cv.id}
                value={cv.id}
                onSelect={() => go(`/cvs?q=${encodeURIComponent(cv.title)}`)}
                className="flex items-center gap-2"
              >
                <FileText className="size-4 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{cv.title}</span>
                <span className="text-muted-foreground text-xs">{t(`cvs.field.${cv.field}`)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t("command.goTo")}>
          <CommandItem value="browse-all" onSelect={() => go("/resources")}>
            <Boxes className="size-4 opacity-60" />
            {t("command.browseAll")}
          </CommandItem>
          <CommandItem value="categories" onSelect={() => go("/categories")}>
            <Hash className="size-4 opacity-60" />
            {t("nav.categories")}
          </CommandItem>
          <CommandItem value="browse-companies" onSelect={() => go("/companies")}>
            <Building2 className="size-4 opacity-60" />
            {t("command.browseCompanies")}
          </CommandItem>
          <CommandItem value="browse-cvs" onSelect={() => go("/cvs")}>
            <FileText className="size-4 opacity-60" />
            {t("command.browseCvs")}
          </CommandItem>
        </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
