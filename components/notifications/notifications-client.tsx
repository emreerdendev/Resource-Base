"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function NotificationsClient() {
  const { t } = useTranslation();
  const { user, loading, openAuth } = useAuth();
  const { items, markAllRead } = useNotifications();

  // Mark everything read when the page is opened.
  useEffect(() => {
    if (user) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Bell className="mx-auto mb-4 size-8 text-muted-foreground" />
        <p className="text-muted-foreground">{t("notifications.signInPrompt")}</p>
        <Button className="mt-4" onClick={() => openAuth()}>
          {t("header.signIn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Bell className="size-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">
          {t("notifications.title")}
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("notifications.empty")}</p>
          <Button asChild className="mt-4">
            <Link href="/resources">{t("favorites.browse")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const inner = (
              <div
                className={cn(
                  "rounded-xl border border-border bg-card p-4 transition-colors",
                  !n.read_at && "border-primary/30 bg-primary/5",
                )}
              >
                <p className="font-medium">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noopener noreferrer">
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
