"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadResourceCounts } from "@/lib/resource-counts";

type FavoriteCountsValue = {
  get: (resourceId: string) => number;
  /** Optimistically adjust a count (delta +1 / -1) when the user toggles. */
  bump: (resourceId: string, delta: number) => void;
  /** Start loading the counts (idempotent). */
  ensure: () => void;
};

const FavoriteCountsContext = createContext<FavoriteCountsValue | null>(null);

const FALLBACK: FavoriteCountsValue = { get: () => 0, bump: () => {}, ensure: () => {} };

export function useFavoriteCounts() {
  const ctx = useContext(FavoriteCountsContext) ?? FALLBACK;
  const { ensure } = ctx;
  // Loading starts when the first component that shows counts mounts.
  useEffect(ensure, [ensure]);
  return ctx;
}

/**
 * How many users favorited each resource (public, from the cached
 * /api/counts). Mirrors ClickCountsProvider: `bump` adjusts locally when the
 * signed-in user toggles their own favorite, so the count moves instantly.
 */
export function FavoriteCountsProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Local toggles made before the counts arrived, applied on top of them.
  const pending = useRef<Record<string, number> | null>({});
  const requested = useRef(false);

  const ensure = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    loadResourceCounts()
      .then((c) => {
        const next = { ...c.favorites };
        for (const [id, delta] of Object.entries(pending.current ?? {}))
          next[id] = Math.max(0, (next[id] ?? 0) + delta);
        pending.current = null; // loaded: later bumps apply directly
        setCounts(next);
      })
      .catch(() => {
        requested.current = false;
      });
  }, []);

  const value = useMemo<FavoriteCountsValue>(
    () => ({
      get: (id) => counts[id] ?? 0,
      bump: (id, delta) => {
        if (pending.current) pending.current[id] = (pending.current[id] ?? 0) + delta;
        setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
      },
      ensure,
    }),
    [counts, ensure],
  );

  return <FavoriteCountsContext.Provider value={value}>{children}</FavoriteCountsContext.Provider>;
}
