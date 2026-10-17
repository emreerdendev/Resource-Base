"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useFavorites } from "@/components/favorites-provider";
import { ResourceGrid } from "@/components/resource-grid";
import { PageHeader } from "@/components/page-header";
import { ResourceGridSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/lib/types";
import { Star } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export function FavoritesClient({ resources }: { resources: Resource[] }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { ids, loading } = useFavorites();
  const favorites = resources.filter((r) => ids.includes(r._id));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={Star} title={t("favorites.title")} description={t("favorites.subtitle")} />

      {!authLoading && !user ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("favorites.signInPrompt")}</p>
          <Button className="mt-4" onClick={() => openAuth()}>
            {t("header.signIn")}
          </Button>
        </div>
      ) : loading || authLoading ? (
        <ResourceGridSkeleton count={6} />
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("favorites.empty")}</p>
          <Button asChild className="mt-4">
            <Link href="/resources">{t("favorites.browse")}</Link>
          </Button>
        </div>
      ) : (
        <ResourceGrid resources={favorites} />
      )}
    </div>
  );
}
