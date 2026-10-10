"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import {
  listTrackedCompanies,
  setCompanyNote,
  setCompanyStatus,
  type TrackedCompany,
} from "@/lib/company-actions";
import type { ApplicationStatus } from "@/lib/company-taxonomy";

type TrackerValue = {
  items: TrackedCompany[];
  loading: boolean;
  get: (companyId: string) => TrackedCompany | undefined;
  /** `null` removes the company from the tracker. */
  setStatus: (companyId: string, status: ApplicationStatus | null) => Promise<void>;
  setNote: (companyId: string, note: string) => Promise<boolean>;
};

const TrackerContext = createContext<TrackerValue | null>(null);

/**
 * Single source of truth for the signed-in user's company tracker (bookmarks +
 * application status + private notes). Fetched once, updated optimistically,
 * shared by every card, modal, the /applications page and the profile.
 */
export function CompanyTrackerProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Rows are tagged with the user they were loaded for, so a sign-out or a
  // user switch never shows stale rows and needs no reset effect.
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; items: TrackedCompany[] }>({
    userId: null,
    items: [],
  });
  const fresh = state.userId === userId;
  const items = useMemo(() => (userId && fresh ? state.items : []), [userId, fresh, state.items]);
  const loading = Boolean(userId) && !fresh;
  const setItems = useCallback(
    (next: TrackedCompany[] | ((prev: TrackedCompany[]) => TrackedCompany[])) =>
      setState((s) => ({
        userId: s.userId,
        items: typeof next === "function" ? next(s.items) : next,
      })),
    [],
  );

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listTrackedCompanies()
      .then((rows) => {
        if (active) setState({ userId, items: rows });
      })
      .catch(() => {
        if (active) setState({ userId, items: [] });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const upsertLocal = useCallback(
    (companyId: string, patch: Partial<TrackedCompany> | null) =>
      setItems((prev) => {
        const rest = prev.filter((x) => x.companyId !== companyId);
        if (patch === null) return rest;
        const current = prev.find((x) => x.companyId === companyId);
        const next: TrackedCompany = {
          companyId,
          status: "saved",
          note: null,
          ...current,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        return [next, ...rest];
      }),
    [setItems],
  );

  const setStatus = useCallback(
    async (companyId: string, status: ApplicationStatus | null) => {
      if (!user) return; // callers open the auth modal instead
      const before = items;
      upsertLocal(companyId, status === null ? null : { status });
      try {
        const res = await setCompanyStatus(companyId, status);
        if (!res.ok) {
          setItems(before);
          toast.error(
            res.error === "rate_limited" ? t("card.favoriteRateLimited") : t("tracker.error"),
          );
        }
      } catch {
        setItems(before);
        toast.error(t("tracker.error"));
      }
    },
    [user, items, upsertLocal, setItems, t],
  );

  const setNote = useCallback(
    async (companyId: string, note: string) => {
      if (!user) return false;
      const before = items;
      upsertLocal(companyId, { note: note.trim() || null });
      try {
        const res = await setCompanyNote(companyId, note);
        if (res.ok) return true;
        setItems(before);
        toast.error(
          res.error === "rate_limited" ? t("card.favoriteRateLimited") : t("tracker.error"),
        );
      } catch {
        setItems(before);
        toast.error(t("tracker.error"));
      }
      return false;
    },
    [user, items, upsertLocal, setItems, t],
  );

  const value = useMemo<TrackerValue>(() => {
    const byId = new Map(items.map((x) => [x.companyId, x]));
    return { items, loading, get: (id) => byId.get(id), setStatus, setNote };
  }, [items, loading, setStatus, setNote]);

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useCompanyTracker() {
  return (
    useContext(TrackerContext) ?? {
      items: [],
      loading: false,
      get: () => undefined,
      setStatus: async () => {},
      setNote: async () => false,
    }
  );
}
