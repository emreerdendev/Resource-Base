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
      const isFav = ids.includes(id);
      // Optimistic — instant across all consumers via shared context.
      setIds((prev) => (isFav ? prev.filter((x) => x !== id) : [...prev, id]));
      // Keep the public favorite count in sync optimistically too.
      bump(id, isFav ? -1 : 1);

      try {
        const res = await toggleFavorite(id);
        // Rate-limited (spam guard): the write didn't happen, so revert the
        // optimistic UI rather than let it lie about the saved state.
        if (res?.error) {
          setIds((prev) =>
            isFav ? [...prev, id] : prev.filter((x) => x !== id),
          );
          bump(id, isFav ? 1 : -1);
          toast.error(
            t(res.error === "unverified" ? "verifyBanner.verifyFirst" : res.error === "rate_limited" ? "card.favoriteRateLimited" : "card.favoriteError"),
          );
        }
      } catch {
        // On failure, revert the optimistic UI so it never lies about state.
        setIds((prev) =>
          isFav ? [...prev, id] : prev.filter((x) => x !== id),
        );
        bump(id, isFav ? 1 : -1);
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
