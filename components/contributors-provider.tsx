"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { PublicProfileCompact } from "@/lib/types";

type ContributorsValue = {
  /** Register a submitter id to be resolved (batched). */
  register: (id: string) => void;
  /** Look up a resolved contributor by user id. */
  get: (id: string) => PublicProfileCompact | undefined;
};

const ContributorsContext = createContext<ContributorsValue | null>(null);

export function useContributors() {
  return (
    useContext(ContributorsContext) ?? {
      register: () => {},
      get: () => undefined,
    }
  );
}

/**
 * Cards register their submittedBy id here. The first registration loads the
 * whole (small, edge-cached) contributor list from /api/contributors once per
 * page load; every card then reads from it — no per-card or per-id requests.
 */
export function ContributorsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [map, setMap] = useState<Record<string, PublicProfileCompact>>({});
  const loading = useRef(false);

  const register = useCallback((id: string) => {
    if (!id || loading.current) return;
    loading.current = true;
    fetch("/api/contributors")
      // A non-OK answer is a failure too, so the next card tries again.
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, PublicProfileCompact>>) : Promise.reject(r.status)))
      .then((data: Record<string, PublicProfileCompact>) => setMap(data))
      .catch(() => {
        loading.current = false; // try again on the next card
      });
  }, []);

  const value = useMemo<ContributorsValue>(
    () => ({ register, get: (id) => map[id] }),
    [register, map],
  );

  return (
    <ContributorsContext.Provider value={value}>
      {children}
    </ContributorsContext.Provider>
  );
}
