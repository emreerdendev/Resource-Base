"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Category, Tag } from "@/lib/types";

type TaxonomyData = { categories: Category[]; tags: Tag[] };
type TaxonomyValue = TaxonomyData & { load: () => void };

const EMPTY: TaxonomyData = { categories: [], tags: [] };

const TaxonomyContext = createContext<TaxonomyValue>({ ...EMPTY, load: () => {} });

/**
 * All categories + tags, so taxonomy-fix editors can offer existing options.
 * Loaded on first use from the edge-cached /api/taxonomy, not with every page;
 * pass `active` false while the UI that needs it is closed.
 */
export function useTaxonomy(active = true): TaxonomyData {
  const { load, categories, tags } = useContext(TaxonomyContext);
  useEffect(() => {
    if (active) load();
  }, [active, load]);
  return { categories, tags };
}

export function TaxonomyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TaxonomyData>(EMPTY);
  const started = useRef(false);
  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/taxonomy")
      .then((r) => (r.ok ? (r.json() as Promise<TaxonomyData>) : EMPTY))
      .then(setData)
      .catch(() => {
        started.current = false; // retry on next use
      });
  }, []);
  const value = useMemo(() => ({ ...data, load }), [data, load]);
  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}
