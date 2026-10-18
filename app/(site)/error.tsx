"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isStaleBuildError, reloadForNewBuild, reloadedRecently } from "@/lib/stale-build";
import { NavLink as Link } from "@/components/nav-link";
import { Home, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page fails to render (e.g. a data source is briefly down).
 * A tab left open across a deploy fails differently — the page's scripts are
 * gone — and is reloaded onto the new build right away instead.
 */
export default function SiteError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  // Decided once: reload unless this tab just did (then show the error).
  const [reloading] = useState(
    () => typeof window !== "undefined" && isStaleBuildError(error) && !reloadedRecently(),
  );
  // A full load: it gets the current build and fresh data, which recovers
  // from both a stale tab and a failed render (router.refresh + reset could
  // only retry with the same, possibly missing, scripts).
  const retry = () => window.location.reload();
  useEffect(() => {
    if (reloading) {
      reloadForNewBuild();
      return;
    }
    console.error(error);
  }, [error, reloading]);
  if (reloading)
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("notFound.errorTitle")}</h1>
      <p className="mt-2 max-w-md text-balance text-muted-foreground">{t("notFound.errorBody")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={retry}>
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
