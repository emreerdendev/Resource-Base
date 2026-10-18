"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useFavorites } from "@/components/favorites-provider";
import { ResourceGrid } from "@/components/resource-grid";
import { PageHeader } from "@/components/page-header";
import { ResourceGridSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/lib/types";
import { Star } from "lucide-react";
import { NavLink as Link } from "@/components/nav-link";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/empty-state";

export function FavoritesClient({ resources }: { resources: Resource[] }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { ids, loading } = useFavorites();
  const favorites = resources.filter((r) => ids.includes(r._id));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={Star} title={t("favorites.title")} description={t("favorites.subtitle")} />

      {!authLoading && !user ? (
        <EmptyState
          icon={Star}
          title={t("favorites.signInPrompt")}
          action={<Button onClick={() => openAuth()}>{t("header.signIn")}</Button>}
        />
      ) : loading || authLoading ? (
        <ResourceGridSkeleton count={6} />
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t("favorites.empty")}
          action={
            <Button asChild>
              <Link href="/resources">{t("favorites.browse")}</Link>
            </Button>
          }
        />
      ) : (
        <ResourceGrid resources={favorites} />
      )}
    </div>
  );
}
