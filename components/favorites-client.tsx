"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { useFavorites } from "@/components/favorites-provider";
import { ResourceGrid } from "@/components/resource-grid";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/lib/types";
import { Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export function FavoritesClient({ resources }: { resources: Resource[] }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const { ids, loading } = useFavorites();
  const favorites = resources.filter((r) => ids.includes(r._id));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <Star className="size-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">
          {t("favorites.title")}
        </h1>
      </div>

      {!authLoading && !user ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("favorites.signInPrompt")}</p>
          <Button className="mt-4" onClick={() => openAuth()}>
            {t("header.signIn")}
          </Button>
        </div>
      ) : loading || authLoading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto size-5 animate-spin" />
        </div>
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
