"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import { useClickCounts } from "@/components/click-counts-provider";
import { useContributors } from "@/components/contributors-provider";
import { useFavoriteCounts } from "@/components/favorite-counts-provider";
import { useFavorites } from "@/components/favorites-provider";
import { ResourceGrid } from "@/components/resource-grid";
import { TaxonomyFixEditor } from "@/components/taxonomy-fix-editor";
import { TaxonomyProposal } from "@/components/taxonomy-proposal";
import { useTaxonomy } from "@/components/taxonomy-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubmissions } from "@/lib/submissions";
import type { ResourceWithRelated } from "@/lib/types";
import { cn, favicon } from "@/lib/utils";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  PencilLine,
  Share2,
  Star,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent/70";

/** Full-page resource view — deep-linkable, shareable counterpart to the modal. */
export function ResourceDetail({ resource }: { resource: ResourceWithRelated }) {
  const { t, i18n } = useTranslation();
  const { has, toggle } = useFavorites();
  const { get, bump } = useClickCounts();
  const { get: getFavorites } = useFavoriteCounts();
  const { register, get: getContributor } = useContributors();
  const { user, openAuth } = useAuth();
  const { categories: allCats, tags: allTags } = useTaxonomy();
  const counted = useRef(false);
  const [copied, setCopied] = useState(false);
  // Taxonomy/description suggestion (account-only), mirroring the modal flow.
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxViewOpen, setTaxViewOpen] = useState(false);

  const icon = favicon(resource.url);
  const broken = resource.linkStatus === "broken";
  const fav = has(resource._id);
  const clicks = get(resource._id);
  const favorites = getFavorites(resource._id);

  // Resolve a proposed slug to its existing title for the read-only view.
  const titleForCat = (slug: string) =>
    allCats.find((c) => c.slug === slug)?.title ?? slug;
  const titleForTag = (slug: string) =>
    allTags.find((tg) => tg.slug === slug)?.title ?? slug;

  // One open taxonomy suggestion per resource — if a pending one exists, show
  // it (read-only) instead of letting the user suggest again.
  const {
    items: mySubmissions,
    loading: submissionsLoading,
    reload: reloadSubmissions,
  } = useSubmissions();
  const pendingTaxFix = user
    ? mySubmissions.find(
        (s) =>
          s.kind === "taxonomy" &&
          s.target_resource_id === resource._id &&
          s.status === "pending",
      )
    : undefined;

  useEffect(() => {
    if (resource.submittedBy) register(resource.submittedBy);
  }, [resource.submittedBy, register]);
  const contributor = resource.submittedBy
    ? getContributor(resource.submittedBy)
    : undefined;

  const addedOn = resource.addedAt
    ? new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(resource.addedAt))
    : undefined;

  function registerClick() {
    if (counted.current) return;
    counted.current = true;
    bump(resource._id);
    fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId: resource._id }),
      keepalive: true,
    }).catch(() => { });
  }

  async function share() {
    const url = window.location.href;
    // Native share sheet when available — never fall through to copy on
    // cancel (that's what made the "copied ✓" tick show after dismissing).
    if (navigator.share) {
      try {
        await navigator.share({ title: resource.name, url });
      } catch {
        /* user cancelled — do nothing */
      }
      return;
    }
    // No native share: copy the link and confirm with the tick.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/resources" className="hover:text-foreground">
          {t("category.home")}
        </Link>
        {resource.categories?.[0] && (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              href={`/category/${resource.categories[0].slug}`}
              className="hover:text-foreground"
            >
              {resource.categories[0].title}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{resource.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="size-7" loading="lazy" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{resource.name}</h1>
          {resource.author && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("card.by", { author: resource.author })}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {broken && (
          <Badge variant="destructive" className="gap-1">
            <TriangleAlert className="size-3" /> {t("card.broken")}
          </Badge>
        )}
        {resource.language?.includes("tr") && <Badge variant="outline">TR</Badge>}
        {resource.pricing && (
          <Badge variant={resource.pricing === "free" ? "outline" : "secondary"}>
            {t(`pricing.${resource.pricing}`)}
          </Badge>
        )}
      </div>

      {taxOpen ? (
        <div className="mt-5">
          <TaxonomyFixEditor
            resource={resource}
            onCancel={() => setTaxOpen(false)}
            onDone={() => {
              setTaxOpen(false);
              reloadSubmissions();
            }}
          />
        </div>
      ) : taxViewOpen && pendingTaxFix ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Clock className="size-3.5" />
            {t("taxonomy.yourSuggestion")}
          </div>
          <TaxonomyProposal
            categoriesLabel={t("modal.categories")}
            tagsLabel={t("modal.tags")}
            descriptionLabel={t("taxonomy.description")}
            proposedCategories={pendingTaxFix.proposed_categories}
            proposedTags={pendingTaxFix.proposed_tags}
            proposedDescription={pendingTaxFix.proposed_description}
            originalCategories={pendingTaxFix.original_categories}
            originalTags={pendingTaxFix.original_tags}
            originalDescription={pendingTaxFix.original_description}
            resolveCategory={titleForCat}
            resolveTag={titleForTag}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setTaxViewOpen(false)}
          >
            {t("taxonomy.close")}
          </Button>
        </div>
      ) : (
        <>
          {/* Description */}
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {resource.description || t("modal.noDescription")}
          </p>

          {/* Categories */}
          {resource.categories?.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("modal.categories")}
              </p>
              <div className="flex flex-wrap gap-2">
                {resource.categories.map((cat) => (
                  <Link key={cat._id} href={`/category/${cat.slug}`} className={PILL}>
                    <CategoryIcon className="size-3.5" />
                    {cat.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {resource.tags?.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("modal.tags")}
              </p>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag) => (
                  <Link key={tag._id} href={`/tag/${tag.slug}`} className={PILL}>
                    {tag.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Meta */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
        {favorites >= 1 && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" />
            {favorites}
          </span>
        )}
        {clicks >= 1 && (
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="size-3.5" />
            {clicks}
          </span>
        )}
        {addedOn && <span>{t("modal.addedOn", { date: addedOn })}</span>}
        {contributor && (
          <Link
            href={`/profile/${contributor.username}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            {contributor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                className="size-4 rounded-full object-cover"
              />
            ) : null}
            {t("card.addedBy", { username: contributor.username })}
          </Link>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => (user ? toggle(resource._id) : openAuth())}
          aria-label={
            !user
              ? t("card.signInToSave")
              : fav
                ? t("card.removeFavorite")
                : t("card.addFavorite")
          }
        >
          <Star className={cn(fav && "fill-primary text-primary")} />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={share}
          aria-label={t("resource.share")}
          title={t("resource.share")}
        >
          {copied ? <Check className="text-emerald-500" /> : <Share2 />}
        </Button>

        {/* Suggest edit (categories / tags / description) — icon-only, matching
            the modal, so a long "pending" label can't break the action row.
            Hidden while the editor or read-only view is already open above. */}
        {!taxOpen &&
          !taxViewOpen &&
          (resource.categories?.length > 0 || resource.tags?.length > 0) &&
          (user && submissionsLoading ? (
            <Button variant="outline" size="icon-lg" disabled>
              <Loader2 className="animate-spin" />
            </Button>
          ) : pendingTaxFix ? (
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setTaxViewOpen(true)}
              title={t("taxonomy.pendingSuggestion")}
              aria-label={t("taxonomy.pendingSuggestion")}
              className="text-amber-600 dark:text-amber-400"
            >
              <Clock />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => (user ? setTaxOpen(true) : openAuth())}
              title={t("taxonomy.editCta")}
              aria-label={t("taxonomy.editCta")}
            >
              <PencilLine />
            </Button>
          ))}

        <Button asChild size="lg" className="flex-1">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={registerClick}
            onAuxClick={registerClick}
          >
            {t("modal.open")}
            <ArrowUpRight />
          </a>
        </Button>
      </div>

      {/* Related */}
      {resource.related?.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("resource.related")}
          </h2>
          <ResourceGrid resources={resource.related} />
        </div>
      )}
    </div>
  );
}
