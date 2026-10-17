"use client";

import Link from "next/link";
import { Boxes, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** The 404 page body, translated. `standalone` adds the logo (no site header). */
export function NotFoundView({ standalone = false }: { standalone?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={
        standalone
          ? "relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
          : "flex flex-col items-center py-20 text-center"
      }
    >
      {standalone && (
        <Link href="/" className="mb-8 flex items-center gap-2 font-semibold transition-opacity hover:opacity-80">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </span>
          Resource Base
        </Link>
      )}
      <p className="text-7xl font-bold tracking-tight text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("notFound.title")}</h1>
      <p className="mt-2 max-w-md text-balance text-muted-foreground">{t("notFound.body")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">
            <Home /> {t("notFound.home")}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/resources">
            <Boxes /> {t("notFound.browse")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
