"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Database, FileText, KeyRound, UserPen, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccountDangerZone } from "@/components/account-danger-zone";
import { useAuth } from "@/components/auth/auth-provider";
import { MyCvPanel } from "@/components/my-cv-panel";
import { PageHeader } from "@/components/page-header";
import { ProfileChangePassword } from "@/components/profile-change-password";
import { ProfileConnectedAccounts } from "@/components/profile-connected-accounts";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { profilePath } from "@/lib/username";

const TABS = [
  { id: "profile", icon: UserRound },
  { id: "cv", icon: FileText },
  { id: "account", icon: KeyRound },
  { id: "data", icon: Database },
] as const;
type TabId = (typeof TABS)[number]["id"];

const isTab = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

/**
 * Edit Profile, split into tabs so each part has room: the public profile,
 * the CV, sign-in & security, and data export/deletion. The active tab lives
 * in `?tab=` so other pages can link straight to one (e.g. ?tab=cv).
 */
export function ProfileSettings() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const { user, loading, openAuth } = useAuth();
  const { profile } = useProfile();
  // The tab is local state, opened from `?tab=`. When a link changes `?tab=`
  // while the page is open (e.g. the menu's "Share Your CV" → ?tab=cv), the
  // tab follows it (adjusted during render, no effect).
  const fromUrl = params.get("tab");
  const urlTab: TabId = isTab(fromUrl) ? fromUrl : "profile";
  const [tab, setTab] = useState<TabId>(urlTab);
  const [seenUrlTab, setSeenUrlTab] = useState<TabId>(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    setTab(urlTab);
  }

  function select(next: TabId) {
    setTab(next);
    // Shallow URL update: shareable, without a server round-trip.
    const url = new URL(window.location.href);
    if (next === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }

  const header = (
    <PageHeader
      icon={UserPen}
      title={t("profile.editTitle")}
      description={t("profile.editSubtitle")}
      actions={
        profile?.username && (
          <Button asChild size="sm" variant="outline">
            <Link href={profilePath(profile.username)}>
              {t("settings.viewProfile")} <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        )
      }
    />
  );

  if (!loading && !user) {
    return (
      <>
        {header}
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("profile.signInPrompt")}</p>
          <Button className="mt-4" onClick={() => openAuth()}>
            {t("header.signIn")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div
        role="tablist"
        aria-label={t("profile.editTitle")}
        className="mb-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => select(id)}
            className={cn(
              "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              tab === id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(`settings.tabs.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "profile" && <ProfileEditForm />}
        {tab === "cv" && <MyCvPanel />}
        {tab === "account" && (
          <div className="space-y-4">
            <ProfileConnectedAccounts />
            <ProfileChangePassword />
          </div>
        )}
        {tab === "data" && <AccountDangerZone />}
      </div>
    </>
  );
}
