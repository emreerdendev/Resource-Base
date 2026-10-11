"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { LanguageToggle } from "@/components/language-toggle";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Boxes, ChevronRight, Menu, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

function openSearch() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/**
 * How much of the header's collapsible text fits, measured (not breakpoint-
 * based) because the available width is capped by the max-w container and the
 * needed width changes with the language and sign-in state:
 *   0 → everything fits, 1 → the search label collapses to its icon,
 *   2 → the "+ Add" label collapses too.
 * A ResizeObserver re-checks whenever the row or any of its items change size.
 */
function useCollapseLevel(
  rowRef: React.RefObject<HTMLDivElement | null>,
  labelsRef: React.RefObject<HTMLSpanElement | null>,
) {
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const row = rowRef.current;
    const labels = labelsRef.current;
    if (!row || !labels) return;
    const width = (key: string) =>
      [...labels.querySelectorAll<HTMLElement>(`[data-label="${key}"]`)].reduce(
        (sum, el) => sum + el.getBoundingClientRect().width,
        0,
      );
    const check = () => {
      const cs = getComputedStyle(row);
      const available =
        row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1;
      const items = [...row.children].filter(
        (el) => el !== labels && getComputedStyle(el).display !== "none",
      );
      const used = items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
      const submit = width("submit");
      const search = width("search");
      setLevel((current) => {
        // Width of the row with no collapsible text, then add labels back.
        const shown = current === 0 ? submit + search : current === 1 ? submit : 0;
        const base = used - shown;
        if (base + submit + search <= available) return 0;
        if (base + submit <= available) return 1;
        return 2;
      });
    };
    const ro = new ResizeObserver(check);
    ro.observe(row);
    for (const el of row.children) ro.observe(el);
    return () => ro.disconnect();
  }, [rowRef, labelsRef]);
  return level;
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
  const level = useCollapseLevel(rowRef, labelsRef);

  // Guests: open the sign-in modal in place (don't yank them to the home page),
  // then forward to /submit after they authenticate. Signed-in: go straight.
  function goSubmit() {
    if (user) router.push(submitHref);
    else openAuth(submitHref);
  }
  return (
    /* Opaque strip masking content that scrolls beneath the floating header. */
    <header className="sticky inset-x-0 top-0 z-50 bg-background px-3 py-4 sm:px-4">
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
          {showSubmit && (
            <span data-label="submit" className="pl-1 font-medium">
              {submitLabel}
            </span>
          )}
          {showSearch && (
            <>
              <span data-label="search" className="pl-2">
                {t("header.searchPlaceholder")}
              </span>
              <span data-label="search" className="pl-2">
                <span className="border px-1.5 font-mono text-[10px]">⌘K</span>
              </span>
            </>
          )}
        </span>

        <NavLink
          href="/"
          className="flex shrink-0 items-center gap-1.5 font-semibold transition-opacity hover:opacity-80 sm:gap-2"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </span>
          <span className="text-[15px] whitespace-nowrap sm:text-base">Resource Base</span>
        </NavLink>

        <span aria-hidden className="hidden shrink-0 text-border md:inline pl-3 pr-1">
          •
        </span>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <NavLink href="/companies" className={navLink(pathname.startsWith("/compan"))}>
            {t("nav.companies")}
          </NavLink>
          <span aria-hidden className="text-border">
            •
          </span>
          {/* Categories are a sub-section of resources, so the pair sits tight. */}
          <div className="flex items-center">
            <NavLink
              href="/resources"
              className={cn(
                navLink(pathname.startsWith("/resources") || pathname.startsWith("/resource/")),
                "pr-1",
              )}
            >
              {t("nav.resources")}
            </NavLink>
            <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground/50" />
            <NavLink
              href="/categories"
              className={cn(navLink(pathname.startsWith("/categor")), "pl-1")}
            >
              {t("nav.categories")}
            </NavLink>
          </div>
          {showSubmit && (
            <span aria-hidden className="text-border">
              •
            </span>
          )}
          {showSubmit && (
            <button
              type="button"
              onClick={goSubmit}
              aria-label={submitLabel}
              title={submitLabel}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="size-3.5" />
              {level < 2 && <span>{submitLabel}</span>}
            </button>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1 sm:gap-2 sm:pl-2">
          {showSearch && (
            <button
              onClick={openSearch}
              aria-label={t("header.searchPlaceholder")}
              title={t("header.searchPlaceholder")}
              className="group flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 text-sm sm:w-auto sm:px-3 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4 transition-transform group-hover:scale-110" />
              {level === 0 && (
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

          {/* Language + theme share one control group (in the menu on mobile). */}
          <div className="hidden md:block">
            <PreferencesGroup />
          </div>
          <UserMenu />
          <MobileMenu
            pathname={pathname}
            submit={showSubmit ? { label: submitLabel, onClick: goSubmit } : null}
          />
        </div>
      </div>
    </header>
  );
}

function PreferencesGroup() {
  return (
    <div className="flex h-9 items-center rounded-lg border border-border bg-muted/40">
      <LanguageToggle />
      <span aria-hidden className="h-5 w-px bg-border" />
      <ThemeToggle />
    </div>
  );
}

/**
 * Below md the nav links don't fit next to the actions, so they move into a
 * menu panel under the header, together with the language + theme controls.
 */
function MobileMenu({
  pathname,
  submit,
}: {
  pathname: string;
  submit: { label: string; onClick: () => void } | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = (active: boolean) =>
    cn(
      "flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted",
      active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
    );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <>
          {/* Click-away layer. */}
          <div className="fixed inset-0 z-40" aria-hidden onClick={close} />
          <div
            id="mobile-menu"
            className="animate-in fade-in slide-in-from-top-1 absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex flex-col gap-1 rounded-xl border border-border/70 bg-background p-2 shadow-lg duration-150"
          >
            <Link href="/companies" onClick={close} className={item(pathname.startsWith("/compan"))}>
              {t("nav.companies")}
            </Link>
            <Link
              href="/resources"
              onClick={close}
              className={item(pathname.startsWith("/resources") || pathname.startsWith("/resource/"))}
            >
              {t("nav.resources")}
            </Link>
            <Link
              href="/categories"
              onClick={close}
              className={cn(item(pathname.startsWith("/categor")), "pl-7")}
            >
              <ChevronRight className="-ml-4 mr-1 size-3 text-muted-foreground/60" />
              {t("nav.categories")}
            </Link>
            {submit && (
              <button
                type="button"
                onClick={() => {
                  close();
                  submit.onClick();
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted"
              >
                <Plus className="size-4" />
                {submit.label}
              </button>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border px-1 pt-2">
              <span className="px-2 text-xs text-muted-foreground">{t("nav.preferences")}</span>
              <PreferencesGroup />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
