"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  LogOut,
  Plus,
  Send,
  Settings,
  Star,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { useNotifications } from "@/lib/notifications";
import { useProfile } from "@/lib/profile";
import { initial } from "@/lib/initial";

export function UserMenu() {
  const { t } = useTranslation();
  const { user, loading, openAuth, signOut } = useAuth();
  const { unread } = useNotifications();
  const { profile } = useProfile();
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);

  if (loading) {
    return <div className="size-9 animate-pulse rounded-full bg-muted" />;
  }

  if (!user) {
    return (
      // Same height/radius as the language + theme group next to it.
      <Button
        variant="outline"
        className="h-9 rounded-lg px-3"
        onClick={() => openAuth()}
      >
        {t("header.signIn")}
      </Button>
    );
  }

  // Prefer the edited DB name; fall back to the Better Auth name, then email.
  const name = profile?.full_name || user.name || user.email || t("nav.account");
  const avatar = profile?.avatar_url || user.image || undefined;
  // Provider avatar URLs can expire or be blocked — fall back to the initial.
  const showAvatar = avatar && avatar !== failedAvatar;
  const profileHref = profile?.username
    ? `/profile/${profile.username}`
    : "/profile/edit";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative size-9 cursor-pointer rounded-full text-sm"
          aria-label={
            unread > 0 ? `${t("nav.account")} · ${t("nav.unread", { count: unread })}` : t("nav.account")
          }
        >
          <span className="grid size-full place-items-center overflow-hidden rounded-full border border-border bg-muted">
            {showAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatar(avatar)}
                className="size-full object-cover"
              />
            ) : (
              <span className="font-medium text-foreground">{initial(name)}</span>
            )}
          </span>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">
          {name}
          {profile?.username && (
            <span className="block text-xs font-normal text-muted-foreground">
              @{profile.username}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Own activity first — applications are the main feature. */}
        <DropdownMenuItem asChild>
          <Link href="/applications">
            <BriefcaseBusiness className="size-4" /> {t("nav.applications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/favorites">
            <Star className="size-4" /> {t("nav.favorites")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/submissions">
            <Send className="size-4" /> {t("nav.submissions")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Bell className="size-4" /> {t("nav.notifications")}
            {unread > 0 && (
              <span
                className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[11px] font-medium text-white"
                aria-label={t("nav.unread", { count: unread })}
              >
                {unread}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/submit?type=company">
            <Building2 className="size-4" /> {t("nav.suggestCompany")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/submit">
            <Plus className="size-4" /> {t("nav.submit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserIcon className="size-4" /> {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/edit">
            <Settings className="size-4" /> {t("nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className="size-4" /> {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
