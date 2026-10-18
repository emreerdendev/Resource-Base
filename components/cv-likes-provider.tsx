"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { toggleCvLike } from "@/lib/cv-actions";
import { loadViewer } from "@/lib/viewer";

type CvLikesValue = {
  liked: (id: string) => boolean;
  /** Listed count adjusted by this session's likes (the list is cached for minutes). */
  count: (id: string, listed: number) => number;
  likedIds: string[];
  loading: boolean;
  toggle: (id: string) => Promise<void>;
};

const CvLikesContext = createContext<CvLikesValue | null>(null);

/** The signed-in user's liked CVs, loaded with the viewer state and updated optimistically. */
export function CvLikesProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ userId?: string; ids: string[] }>({ ids: [] });
  // Likes toggled this session: +1 / -1 on top of the cached listing count.
  const [delta, setDelta] = useState<Record<string, number>>({});
  const ids = useMemo(() => (state.userId === userId ? state.ids : []), [state, userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadViewer(userId)
      .then((v) => active && setState({ userId, ids: v.likedCvs }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (id: string) => {
      if (!userId) return;
      const was = ids.includes(id);
      const apply = (on: boolean) => {
        setState((s) => ({
          userId,
          ids: on ? [...s.ids.filter((x) => x !== id), id] : s.ids.filter((x) => x !== id),
        }));
        setDelta((d) => ({ ...d, [id]: (d[id] ?? 0) + (on ? 1 : -1) }));
      };
      apply(!was);
      try {
        // The wanted state, not a flip (see favorites); the reply is what's saved.
        const res = await toggleCvLike(id, !was);
        const saved = res.error && res.error !== "rate_limited" ? was : res.liked;
        if (saved !== !was) apply(saved);
        if (res.error)
          toast.error(t(res.error === "unverified" ? "verifyBanner.verifyFirst" : res.error === "rate_limited" ? "card.favoriteRateLimited" : "cvs.likeError"));
      } catch {
        apply(was);
        toast.error(t("cvs.likeError"));
      }
    },
    [userId, ids, t],
  );

  const value = useMemo<CvLikesValue>(
    () => ({
      liked: (id) => ids.includes(id),
      count: (id, listed) => Math.max(0, listed + (delta[id] ?? 0)),
      likedIds: ids,
      loading: Boolean(userId) && state.userId !== userId,
      toggle,
    }),
    [ids, delta, userId, state.userId, toggle],
  );

  return <CvLikesContext.Provider value={value}>{children}</CvLikesContext.Provider>;
}

export function useCvLikes(): CvLikesValue {
  const ctx = useContext(CvLikesContext);
  if (!ctx) throw new Error("useCvLikes must be used within <CvLikesProvider>");
  return ctx;
}
