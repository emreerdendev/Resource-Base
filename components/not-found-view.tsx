"use client";

import Link from "next/link";
import { Boxes, Building2, FileText, Home, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { Button } from "@/components/ui/button";

/** Open the ⌘K search palette. */
function openSearch() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/**
 * The 404 body: what happened, then every way back in — home, the three
 * directories (site order) and search.
 */
export function NotFoundView() {
  const { t } = useTranslation();
  const dirs = [
    { href: "/resources", icon: Boxes, label: t("nav.resources") },
    { href: "/companies", icon: Building2, label: t("nav.companies") },
    { href: "/cvs", icon: FileText, label: t("nav.cvs") },
  ];
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center">
      <p className="text-7xl font-bold tracking-tight text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("notFound.title")}</h1>
      <p className="mt-2 max-w-md text-balance text-muted-foreground">{t("notFound.body")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="lg">
          <Link href="/">
            <Home /> {t("notFound.home")}
          </Link>
        </Button>
        <Button size="lg" variant="outline" onClick={openSearch}>
          <Search /> {t("notFound.search")}
        </Button>
      </div>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
        {dirs.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40"
          >
            <Icon className="size-4 text-primary" /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
