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
import { toggleFavorite } from "@/lib/data-actions";
import { loadViewer } from "@/lib/viewer";
import { useAuth } from "@/components/auth/auth-provider";
import { useFavoriteCountsBump } from "@/components/favorite-counts-provider";

type FavoritesValue = {
  ids: string[];
  loading: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

/**
 * Single source of truth for the signed-in user's favorites. Fetched once,
 * updated optimistically, shared across every card and the favorites page —
 * so favoriting on the home page is instantly reflected everywhere (no refresh).
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Not useFavoriteCounts(): that would load the counts on every page.
  const bump = useFavoriteCountsBump();
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  useEffect(() => {
    let active = true;
    if (!userId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setIds([]);
        setLoading(false);
      });
    } else {
      loadViewer(userId)
        .then((v) => active && setIds(v.favorites))
        .catch(() => {})
        .finally(() => active && setLoading(false));
    }
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (id: string) => {
      if (!user) return; // callers open the auth modal instead
      const want = !ids.includes(id);
      // Shown as `on` locally (the public count moves with it).
      const show = (on: boolean) => {
        setIds((prev) => (on ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)));
        bump(id, on ? 1 : -1);
      };
      // Optimistic — instant across all consumers via shared context.
      show(want);
      try {
        // Sends the wanted state, so a stale screen never flips a saved one;
        // the reply is what's saved.
        const res = await toggleFavorite(id, want);
        const saved = res.error && res.error !== "rate_limited" ? !want : res.favorited;
        if (saved !== want) show(saved);
        if (res.error)
          toast.error(
            t(res.error === "unverified" ? "verifyBanner.verifyFirst" : res.error === "rate_limited" ? "card.favoriteRateLimited" : "card.favoriteError"),
          );
      } catch {
        // On failure, revert the optimistic UI so it never lies about state.
        show(!want);
        toast.error(t("card.favoriteError"));
      }
    },
    [user, ids, bump, t],
  );

  const value = useMemo<FavoritesValue>(
    () => ({ ids, loading, has: (id) => ids.includes(id), toggle }),
    [ids, loading, toggle],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return (
    useContext(FavoritesContext) ?? {
      ids: [],
      loading: false,
      has: () => false,
      toggle: async () => {},
    }
  );
}
