"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadResourceCounts } from "@/lib/resource-counts";

type ClickCountsValue = {
  get: (resourceId: string) => number;
  bump: (resourceId: string) => void;
  /** Start loading the counts (idempotent). */
  ensure: () => void;
};

const ClickCountsContext = createContext<ClickCountsValue | null>(null);

const FALLBACK: ClickCountsValue = { get: () => 0, bump: () => {}, ensure: () => {} };

export function useClickCounts() {
  const ctx = useContext(ClickCountsContext) ?? FALLBACK;
  const { ensure } = ctx;
  // Loading starts when the first component that shows counts mounts.
  useEffect(ensure, [ensure]);
  return ctx;
}

/**
 * Resource click counts (public, from the cached /api/counts) exposed via
 * context. `bump` optimistically increments locally; the actual increment is
 * sent by lib/track-click.
 */
export function ClickCountsProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const requested = useRef(false);

  const ensure = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    loadResourceCounts()
      .then((c) => setCounts((prev) => ({ ...c.clicks, ...bumped(prev, c.clicks) })))
      .catch(() => {
        requested.current = false;
      });
  }, []);

  const value = useMemo<ClickCountsValue>(
    () => ({
      get: (id) => counts[id] ?? 0,
      bump: (id) => setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 })),
      ensure,
    }),
    [counts, ensure],
  );

  return <ClickCountsContext.Provider value={value}>{children}</ClickCountsContext.Provider>;
}

/** Keep clicks bumped before the counts arrived (server count + local bump). */
function bumped(local: Record<string, number>, server: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const id in local) out[id] = (server[id] ?? 0) + local[id];
  return out;
}
