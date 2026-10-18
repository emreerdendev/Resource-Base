"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/page-header";
import { RowListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { useNotifications, type Notification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { NavLink as Link } from "@/components/nav-link";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const KINDS = ["new", "fix", "taxonomy", "removal", "company", "companyEdit", "cv"];

/**
 * Title + body in the reader's language. Notifications carry a structured
 * `data` payload; older rows without it fall back to their stored English.
 */
function useMessage(n: Notification): { title: string; body: string | null } {
  const { t } = useTranslation();
  const d = n.data;
  if (!d || !KINDS.includes(d.kind) || !d.name) return { title: n.title ?? "", body: n.body };
  if (n.type === "submission_approved")
    return {
      title: t(`notifications.approvedTitle.${d.kind}`),
      body: t(`notifications.approvedBody.${d.kind}`, { name: d.name }),
    };
  const hint = t(
    `notifications.resubmitHint.${d.kind === "company" || d.kind === "cv" ? d.kind : "other"}`,
  );
  return {
    title: t("notifications.rejectedTitle"),
    body: d.reason
      ? `${t("notifications.rejectedReason", { name: d.name, reason: d.reason })} ${hint}`
      : `${t("notifications.rejectedBody", { name: d.name })} ${hint}`,
  };
}

function NotificationItem({ n, highlight }: { n: Notification; highlight: boolean }) {
  const { i18n } = useTranslation();
  const { title, body } = useMessage(n);
  const date = new Date(n.created_at).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const inner = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors",
        n.url && "hover:border-primary/40",
        highlight && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 font-medium">{title}</p>
        <time dateTime={n.created_at} className="shrink-0 text-xs text-muted-foreground">
          {date}
        </time>
      </div>
      {body && <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>}
    </div>
  );
  if (!n.url) return inner;
  // Site pages open in place; outside links (a fixed resource URL) in a new tab.
  return n.url.startsWith("/") ? (
    <Link href={n.url}>{inner}</Link>
  ) : (
    <a href={n.url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  );
}

export function NotificationsClient() {
  const { t } = useTranslation();
  const { user, loading, openAuth } = useAuth();
  const { items, loading: listLoading, unread, isNew, markAllRead } = useNotifications();

  // Opening the page reads everything — including notifications that arrive
  // after mount (they load asynchronously). They stay highlighted via isNew.
  useEffect(() => {
    if (unread > 0) markAllRead();
  }, [unread, markAllRead]);

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
      <PageHeader
        icon={Bell}
        title={t("notifications.title")}
        description={t("notifications.subtitle")}
      />

      {loading || listLoading ? (
        <RowListSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("notifications.empty")}</p>
          <Button asChild className="mt-4">
            <Link href="/companies">{t("notifications.browse")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} highlight={!n.read_at || isNew(n.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
