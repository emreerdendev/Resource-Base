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
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  PencilLine,
  Share2,
  Star,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { NavLink as Link } from "@/components/nav-link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { trackClick } from "@/lib/track-click";
import { profilePath } from "@/lib/username";
import { ContributorNote } from "@/components/contributor-note";

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
  const counted = useRef(false);
  const [copied, setCopied] = useState(false);
  // Taxonomy/description suggestion (account-only), mirroring the modal flow.
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxViewOpen, setTaxViewOpen] = useState(false);
  // Only the pending-suggestion view needs titles for proposed slugs.
  const { categories: allCats, tags: allTags } = useTaxonomy(taxViewOpen);

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
    if (trackClick(resource._id)) bump(resource._id);
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
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="size-7" loading="lazy" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {/* Name and "Open Page" are one link, sitting on one baseline. */}
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={registerClick}
              onAuxClick={registerClick}
              className="group underline-offset-4"
            >
              <span className="group-hover:underline">{resource.name}</span>{" "}
              <span className="ml-1 inline-flex items-baseline gap-1 text-sm font-normal tracking-normal whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground group-hover:underline">
                {t("company.openPage")}
                <ExternalLink className="size-3.5 self-center" />
              </span>
            </a>
          </h1>
          {resource.author && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("card.by", { author: resource.author })}
            </p>
          )}
        </div>
        {/* Favorite sits top right, like Save on the company page. */}
        <Button
          variant="outline"
          size="lg"
          onClick={() => (user ? toggle(resource._id) : openAuth())}
          aria-pressed={fav}
          className={cn(fav && "border-primary/50 text-primary")}
        >
          <Star className={cn(fav && "fill-primary text-primary")} />
          {t(fav ? "card.favorited" : "card.favorite")}
        </Button>
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
            <span className="flex-1">{t("taxonomy.yourSuggestion")}</span>
            <button
              type="button"
              onClick={() => setTaxViewOpen(false)}
              aria-label={t("taxonomy.close")}
              title={t("taxonomy.close")}
              className="-m-1 grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
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
            originalName={pendingTaxFix.name}
            originalUrl={pendingTaxFix.url}
            proposedName={pendingTaxFix.proposed_name}
            proposedUrl={pendingTaxFix.proposed_url}
            proposeRemoval={pendingTaxFix.propose_removal}
            removalNote={pendingTaxFix.note}
            resolveCategory={titleForCat}
            resolveTag={titleForTag}
          />
          {/* Where the user follows this suggestion's review. */}
          <Link
            href="/submissions"
            className="inline-flex items-center gap-1 self-end text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
          >
            {t("taxonomy.track")} <ArrowRight className="size-3" />
          </Link>
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

          {/* What the contributor wrote when suggesting it — last, above the meta row. */}
          {resource.contributorNote && (
            <div className="mt-6">
              <ContributorNote note={resource.contributorNote} userId={resource.submittedBy} />
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
            href={profilePath(contributor.username)}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            {contributor.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                referrerPolicy="no-referrer"
                className="size-4 rounded-full object-cover"
              />
            ) : null}
            {t("card.addedBy", { username: contributor.username })}
          </Link>
        )}
      </div>

      {/* Share · suggest edit — the editor / read-only suggestion view render above. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="lg" onClick={share}>
          {copied ? <Check className="text-emerald-500" /> : <Share2 />}
          {copied ? t("resource.linkCopied") : t("resource.share")}
        </Button>
        {user && submissionsLoading ? (
          <Button variant="outline" size="lg" disabled>
            <Loader2 className="animate-spin" />
            {t("taxonomy.editShort")}
          </Button>
        ) : pendingTaxFix ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setTaxViewOpen((o) => !o)}
            aria-pressed={taxViewOpen}
            title={t("taxonomy.pendingSuggestion")}
            className="text-amber-600 dark:text-amber-400"
          >
            <Clock />
            {t("taxonomy.pending")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => (user ? setTaxOpen((o) => !o) : openAuth())}
            aria-pressed={taxOpen}
          >
            <PencilLine />
            {t("taxonomy.editShort")}
          </Button>
        )}
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
