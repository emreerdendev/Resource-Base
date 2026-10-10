"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Boxes, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

function openSearch() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

export function SiteHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth } = useAuth();
  // The directory pages already have a big inline search, so hide this one there.
  const showSearch = pathname !== "/" && pathname !== "/resources";
  const navLink = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-md px-2 py-2 text-sm transition-colors hover:text-foreground",
      active ? "font-medium text-foreground" : "text-muted-foreground",
    );

  // Guests: open the sign-in modal in place (don't yank them to the home page),
  // then forward to /submit after they authenticate. Signed-in: go straight.
  function goSubmit() {
    if (user) router.push("/submit");
    else openAuth("/submit");
  }
  return (
    /* Opaque strip masking content that scrolls beneath the floating header. */
    <header className="sticky px-4 inset-x-0 top-0 z-50 py-4 bg-background">
      <div className="mx-auto flex h-14 max-w-4xl items-center rounded-xl border border-border/70 bg-background/95 px-3 shadow-lg shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 sm:px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </span>
          <span className="hidden whitespace-nowrap sm:inline">Resource Base</span>
        </Link>

        <span aria-hidden className="hidden text-border md:inline pl-3 pr-1">
          •
        </span>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className={navLink(pathname === "/" || pathname.startsWith("/company/"))}
          >
            {t("nav.companies")}
          </Link>
          <Link
            href="/resources"
            className={navLink(pathname.startsWith("/resources") || pathname.startsWith("/resource/"))}
          >
            {t("nav.resources")}
          </Link>
          <Link
            href="/categories"
            className={navLink(pathname.startsWith("/categor"))}
          >
            {t("nav.categories")}
          </Link>
          <button
            type="button"
            onClick={goSubmit}
            aria-label={t("nav.submit")}
            title={t("nav.submit")}
            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <Plus className="size-3.5" />
            {/* Icon-only until there is room for the label next to 3 nav links. */}
            <span className="hidden lg:inline">{t("nav.submit")}</span>
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {showSearch && (
            <button
              onClick={openSearch}
              className="group flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline md:hidden lg:inline">
                {t("header.searchPlaceholder")}
              </span>
              <kbd className="ml-2 hidden rounded border border-border bg-background px-1.5 font-mono text-[10px] sm:inline md:hidden lg:inline">
                ⌘K
              </kbd>
            </button>
          )}

          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
