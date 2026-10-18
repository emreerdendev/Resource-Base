"use client";

import { UserMenu } from "@/components/auth/user-menu";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { LanguageToggle } from "@/components/language-toggle";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Boxes, ChevronRight, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NavLink as Link } from "@/components/nav-link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

function openSearch() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/**
 * Whether the search button's label ("Search… ⌘K") fits, measured (not
 * breakpoint-based) because the available width is capped by the max-w
 * container and the needed width changes with the language and sign-in
 * state: 0 → it fits, 1 → the button collapses to its icon. A ResizeObserver
 * re-checks whenever the row or any of its items change size.
 */
function useCollapseLevel(
  rowRef: React.RefObject<HTMLDivElement | null>,
  labelsRef: React.RefObject<HTMLSpanElement | null>,
) {
  const [level, setLevel] = useState<0 | 1>(0);
  useEffect(() => {
    const row = rowRef.current;
    const labels = labelsRef.current;
    if (!row || !labels) return;
    const check = () => {
      const cs = getComputedStyle(row);
      const available =
        row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1;
      const items = [...row.children].filter(
        (el) => el !== labels && getComputedStyle(el).display !== "none",
      );
      const used = items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
      const search = [...labels.querySelectorAll<HTMLElement>('[data-label="search"]')].reduce(
        (sum, el) => sum + el.getBoundingClientRect().width,
        0,
      );
      // Width of the row without the label, then see if the label fits back.
      setLevel((current) => ((current === 0 ? used : used + search) <= available ? 0 : 1));
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
  // ⌘K searches companies AND resources, so it stays available everywhere
  // (the directory pages' inline search only filters their own list).
  const showSearch = true;
  // Sections read in the main text colour; Categories (a sub-page of
  // Resources) stays muted. The current section is underlined, which doesn't
  // shift the layout the way a bolder weight would.
  const navLink = (active: boolean, muted = false) =>
    cn(
      "whitespace-nowrap rounded-md px-2 py-2 text-sm underline-offset-[6px] transition-colors",
      muted ? "text-muted-foreground hover:text-foreground" : "text-foreground hover:text-foreground/80",
      active && "underline decoration-primary decoration-2",
    );

  const rowRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLSpanElement>(null);
  const level = useCollapseLevel(rowRef, labelsRef);

  return (
    /* Opaque strip masking content that scrolls beneath the floating header.
       Layers, lowest first: sticky page toolbars z-20 · cookie banner z-30 ·
       this header and its mobile menu z-40 · dialogs, dropdowns, toasts z-50+. */
    <header className="sticky inset-x-0 top-0 z-40 bg-background px-3 py-4 sm:px-4">
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
              className={cn(navLink(pathname.startsWith("/categor"), true), "pl-1")}
            >
              {t("nav.categories")}
            </NavLink>
          </div>
          <span aria-hidden className="text-border">
            •
          </span>
          <NavLink href="/companies" className={navLink(pathname.startsWith("/compan"))}>
            {t("nav.companies")}
          </NavLink>
          <span aria-hidden className="text-border">
            •
          </span>
          <NavLink href="/cvs" className={navLink(pathname.startsWith("/cvs"))}>
            {t("nav.cvs")}
          </NavLink>
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
          <MobileMenu pathname={pathname} />
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
function MobileMenu({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  // Escape closes the menu and returns focus to its toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const item = (active: boolean, muted = false) =>
    cn(
      "flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted",
      muted ? "text-muted-foreground" : "text-foreground",
      active && "bg-muted font-medium text-foreground",
    );

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
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
          <div className="fixed inset-0" aria-hidden onClick={close} />
          <div
            id="mobile-menu"
            className="animate-in fade-in slide-in-from-top-1 absolute inset-x-0 top-[calc(100%+0.5rem)] z-10 flex flex-col gap-1 rounded-xl border border-border/70 bg-background p-2 shadow-lg duration-150"
          >
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
              className={cn(item(pathname.startsWith("/categor"), true), "pl-7")}
            >
              <ChevronRight className="-ml-4 mr-1 size-3 text-muted-foreground/60" />
              {t("nav.categories")}
            </Link>
            <Link href="/companies" onClick={close} className={item(pathname.startsWith("/compan"))}>
              {t("nav.companies")}
            </Link>
            <Link href="/cvs" onClick={close} className={item(pathname.startsWith("/cvs"))}>
              {t("nav.cvs")}
            </Link>
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
