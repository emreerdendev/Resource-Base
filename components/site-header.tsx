"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Boxes, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

function openSearch() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/**
 * True when the header row can't fit the "+ Add" and search labels, so they
 * collapse to icons. Measured (not breakpoint-based): the available width is
 * capped by the max-w container and the needed width changes with the language
 * and sign-in state. A ResizeObserver re-checks whenever the row or any of its
 * items (e.g. translated labels) change size.
 */
function useCompactRow(
  rowRef: React.RefObject<HTMLDivElement | null>,
  labelsRef: React.RefObject<HTMLSpanElement | null>,
) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const row = rowRef.current;
    const labels = labelsRef.current;
    if (!row || !labels) return;
    const check = () => {
      const cs = getComputedStyle(row);
      const available =
        row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const items = [...row.children].filter(
        (el) => el !== labels && getComputedStyle(el).display !== "none",
      );
      const used = items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
      // Width the labels add back when expanded (each measured with its gap).
      const extra = [...labels.children].reduce(
        (sum, el) => sum + el.getBoundingClientRect().width,
        0,
      );
      setCompact((was) => (was ? used + extra : used) > available + 1);
    };
    const ro = new ResizeObserver(check);
    ro.observe(row);
    for (const el of row.children) ro.observe(el);
    return () => ro.disconnect();
  }, [rowRef, labelsRef]);
  return compact;
}

export function SiteHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth } = useAuth();
  // ⌘K searches companies AND resources, so it stays available everywhere
  // (the directory pages' inline search only filters their own list).
  const showSearch = true;
  const navLink = (active: boolean) =>
    cn(
      "whitespace-nowrap rounded-md px-2 py-2 text-sm transition-colors hover:text-foreground",
      active ? "font-medium text-foreground" : "text-muted-foreground",
    );

  // On the company side, "+" suggests a company; everywhere else a resource.
  // Hidden on the homepage, which is just the entry point to both sides.
  const companySide =
    pathname.startsWith("/compan") || pathname.startsWith("/applications");
  const showSubmit = pathname !== "/";
  const submitHref = companySide ? "/submit?type=company" : "/submit";
  const submitLabel = companySide ? t("nav.suggestCompany") : t("nav.submit");

  const rowRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLSpanElement>(null);
  const compact = useCompactRow(rowRef, labelsRef);

  // Guests: open the sign-in modal in place (don't yank them to the home page),
  // then forward to /submit after they authenticate. Signed-in: go straight.
  function goSubmit() {
    if (user) router.push(submitHref);
    else openAuth(submitHref);
  }
  return (
    /* Opaque strip masking content that scrolls beneath the floating header. */
    <header className="sticky px-4 inset-x-0 top-0 z-50 py-4 bg-background">
      <div
        ref={rowRef}
        className="relative mx-auto flex h-14 max-w-4xl items-center rounded-xl border border-border/70 bg-background/95 px-3 shadow-lg shadow-black/5 ring-1 ring-black/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 sm:px-4"
      >
        {/* Off-screen copies of the collapsible labels, so their width is known
            even while they're hidden. Each includes the spacing it brings. */}
        <span
          ref={labelsRef}
          aria-hidden
          className="pointer-events-none invisible absolute top-0 left-0 flex text-sm whitespace-nowrap"
        >
          {showSubmit && <span className="pl-1 font-medium">{submitLabel}</span>}
          {showSearch && (
            <>
              <span className="pl-2">{t("header.searchPlaceholder")}</span>
              <span className="pl-2">
                <span className="border px-1.5 font-mono text-[10px]">⌘K</span>
              </span>
            </>
          )}
        </span>

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold transition-opacity hover:opacity-80"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </span>
          <span className="hidden whitespace-nowrap sm:inline">Resource Base</span>
        </Link>

        <span aria-hidden className="hidden shrink-0 text-border md:inline pl-3 pr-1">
          •
        </span>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <Link href="/companies" className={navLink(pathname.startsWith("/compan"))}>
            {t("nav.companies")}
          </Link>
          <span aria-hidden className="text-border">
            •
          </span>
          <Link
            href="/resources"
            className={navLink(pathname.startsWith("/resources") || pathname.startsWith("/resource/"))}
          >
            {t("nav.resources")}
          </Link>
          {/* Categories belong to the resource side. */}
          <ChevronRight aria-hidden className="size-3.5 text-muted-foreground/50" />
          <Link
            href="/categories"
            className={navLink(pathname.startsWith("/categor"))}
          >
            {t("nav.categories")}
          </Link>
          {showSubmit && (
            <button
              type="button"
              onClick={goSubmit}
              aria-label={submitLabel}
              title={submitLabel}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="size-3.5" />
              {!compact && <span>{submitLabel}</span>}
            </button>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {showSearch && (
            <button
              onClick={openSearch}
              aria-label={t("header.searchPlaceholder")}
              title={t("header.searchPlaceholder")}
              className="group flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4 transition-transform group-hover:scale-110" />
              {!compact && (
                <>
                  <span className="hidden whitespace-nowrap sm:inline">
                    {t("header.searchPlaceholder")}
                  </span>
                  <kbd className="hidden rounded border border-border bg-background px-1.5 font-mono text-[10px] sm:inline">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          )}

          {/* Language + theme share one control group. */}
          <div className="flex h-9 items-center rounded-lg border border-border bg-muted/40">
            <LanguageToggle />
            <span aria-hidden className="h-5 w-px bg-border" />
            <ThemeToggle />
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
