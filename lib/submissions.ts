"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listSubmissions } from "@/lib/data-actions";
import { useAuth } from "@/components/auth/auth-provider";
import type { Submission } from "@/lib/types";
import { loadViewer } from "@/lib/viewer";

type SubmissionsValue = {
  items: Submission[];
  loading: boolean;
  reload: () => Promise<void>;
};

const SubmissionsContext = createContext<SubmissionsValue | null>(null);

/**
 * Loads the signed-in user's submissions ONCE (RLS-scoped) and shares them via
 * context, so every resource modal can read "do I have a pending suggestion?"
 * synchronously — no per-card query, no flicker between "Suggest edit" and
 * "Suggestion pending". Reloads on window focus to pick up moderation changes.
 */
export function SubmissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await listSubmissions();
    setItems(data as Submission[]);
    setLoading(false);
  }, [user]);

  // Load once when auth resolves. We deliberately don't refetch on window
  // focus — moderation decisions are rare and already arrive via notifications,
  // so refetching on every tab refocus only caused redundant queries.
  const userId = user?.id;
  useEffect(() => {
    let active = true;
    if (!userId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setItems([]);
        setLoading(false);
      });
    } else {
      loadViewer(userId)
        .then((v) => active && setItems(v.submissions as Submission[]))
        .catch(() => {})
        .finally(() => active && setLoading(false));
    }
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<SubmissionsValue>(
    () => ({ items, loading, reload: load }),
    [items, loading, load],
  );

  return createElement(SubmissionsContext.Provider, { value }, children);
}

export function useSubmissions(): SubmissionsValue {
  return (
    useContext(SubmissionsContext) ?? {
      items: [],
      loading: false,
      reload: async () => {},
    }
  );
}
