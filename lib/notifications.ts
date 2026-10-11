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
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationRow,
} from "@/lib/data-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { loadViewer } from "@/lib/viewer";

export type Notification = NotificationRow;

type NotificationsValue = {
  items: Notification[];
  unread: number;
  /** Unread when this page load marked them read — still shown as new. */
  isNew: (id: string) => boolean;
  markAllRead: () => Promise<void>;
  reload: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * The signed-in user's notifications, shared by the header badge and the
 * notifications page so marking them read clears the badge immediately.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ userId?: string; items: Notification[] }>({
    items: [],
  });
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  // Signed out (or switched user): nothing to show, no effect needed.
  const items = useMemo(
    () => (state.userId === userId ? state.items : []),
    [state, userId],
  );

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadViewer(userId)
      .then((v) => active && setState({ userId, items: v.notifications }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const reload = useCallback(async () => {
    if (!userId) return;
    setState({ userId, items: await listNotifications() });
  }, [userId]);

  const unreadIds = useMemo(() => items.filter((n) => !n.read_at).map((n) => n.id), [items]);

  const markAllRead = useCallback(async () => {
    if (!userId || unreadIds.length === 0) return;
    const now = new Date().toISOString();
    setNewIds((prev) => new Set([...prev, ...unreadIds]));
    setState((s) => ({
      ...s,
      items: s.items.map((n) => ({ ...n, read_at: n.read_at ?? now })),
    }));
    await markAllNotificationsRead().catch(() => {});
  }, [userId, unreadIds]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread: unreadIds.length,
      isNew: (id) => newIds.has(id),
      markAllRead,
      reload,
    }),
    [items, unreadIds, newIds, markAllRead, reload],
  );

  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationsProvider>");
  return ctx;
}
