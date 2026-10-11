"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Star, TrendingUp } from "lucide-react";
import { cn, favicon } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useFavorites } from "@/components/favorites-provider";
import { useClickCounts } from "@/components/click-counts-provider";
import { useFavoriteCounts } from "@/components/favorite-counts-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { ResourceModal } from "@/components/resource-modal";
import type { Resource } from "@/lib/types";
import { trackClick } from "@/lib/track-click";

/**
 * Compact card: site icon + name + favorite toggle (with public favorite
 * count) + click count. Everything else — description, pricing, tags,
 * categories, contributor — lives in the detail modal, which opens when the
 * card body is clicked. The name itself stays a direct link to the resource.
 */
export function ResourceCard({ resource }: { resource: Resource }) {
  const { t } = useTranslation();
  const { has, toggle } = useFavorites();
  const { get, bump } = useClickCounts();
  const { get: getFavorites } = useFavoriteCounts();
  const { user, openAuth } = useAuth();
  const counted = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const fav = has(resource._id);
  const icon = favicon(resource.url);
  const broken = resource.linkStatus === "broken";
  const clicks = get(resource._id);
  const favorites = getFavorites(resource._id);

  // Fire-and-forget click increment, deduped per day in the browser and per
  // IP on the server. The link opens in a new tab, so
  // there's no navigation race — we don't preventDefault. Opening the modal
  // does NOT call this, so browsing details never counts as a click.
  function registerClick() {
    if (counted.current) return;
    counted.current = true;
    if (trackClick(resource._id)) bump(resource._id);
  }

  return (
    <>
      <div
        className={cn(
          "card-hover group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
          broken && "border-destructive/50",
        )}
      >
        {/* Card body opens the detail modal. Sits behind the interactive
            elements (name link, star) which carry their own z-10. */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t("modal.viewDetails")}
          className="absolute inset-0 z-0 cursor-pointer rounded-xl"
        />

        {/* Top row: icon (borderless) + name */}
        <div className="flex items-center gap-3">
          <span className="relative z-10 grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/50">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="size-5" loading="lazy" />
            ) : null}
          </span>

          <div className="min-w-0 flex-1">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={registerClick}
              onAuxClick={registerClick}
              className="relative z-10 inline-flex max-w-full items-center gap-1 font-medium leading-tight hover:underline"
            >
              <span className="truncate">{resource.name}</span>
              <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>
          </div>
        </div>

        {/* Bottom row: pricing (left) · click count + favorite toggle (right).
            The favorite count IS the toggle button — one star, not two. */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {resource.pricing && (
            <Badge
              variant={resource.pricing === "free" ? "outline" : "secondary"}
              className="text-[10px]"
            >
              {t(`pricing.${resource.pricing}`)}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3">
            {clicks >= 1 && (
              <span className="inline-flex items-center gap-0.5">
                <TrendingUp className="size-3" />
                {clicks}
              </span>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Favorites are account-only — prompt sign-in for guests.
                if (!user) {
                  openAuth();
                  return;
                }
                toggle(resource._id);
              }}
              aria-label={
                !user
                  ? t("card.signInToSave")
                  : fav
                    ? t("card.removeFavorite")
                    : t("card.addFavorite")
              }
              className="relative z-10 inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md transition-colors hover:text-foreground"
            >
              <Star
                className={cn("size-3", fav && "fill-primary text-primary")}
              />
              {favorites >= 1 && favorites}
            </button>
          </div>
        </div>
      </div>

      <ResourceModal
        resource={resource}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onNavigate={registerClick}
      />
    </>
  );
}
