"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Shown when a page fails to render (e.g. a data source is briefly down). */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("notFound.errorTitle")}</h1>
      <p className="mt-2 max-w-md text-balance text-muted-foreground">{t("notFound.errorBody")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          <RotateCw /> {t("notFound.retry")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">
            <Home /> {t("notFound.home")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
