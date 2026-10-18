"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import { useClickCounts } from "@/components/click-counts-provider";
import { useContributors } from "@/components/contributors-provider";
import { useFavoriteCounts } from "@/components/favorite-counts-provider";
import { useFavorites } from "@/components/favorites-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxonomyFixEditor } from "@/components/taxonomy-fix-editor";
import { TaxonomyProposal } from "@/components/taxonomy-proposal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubmissions } from "@/lib/submissions";
import { useTaxonomy } from "@/components/taxonomy-provider";
import type { Resource } from "@/lib/types";
import { cn, favicon } from "@/lib/utils";
import {
  ArrowRight,
  ExternalLink,
  X,
  Info,
  Clock,
  Loader2,
  PencilLine,
  Star,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { NavLink as Link } from "@/components/nav-link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Separator } from "./ui/separator";
import { normalizeWebUrl } from "@/lib/company-input";
import { fieldProps } from "@/lib/use-form-errors";
import { profilePath } from "@/lib/username";

/** Pill shared with the resource card — accent background, rounded, hover. */
const PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent/70";

/**
 * Detail view for a single resource, opened when the card body (not the title
 * link) is clicked. Surfaces everything the compact card truncates: full
 * description, pricing, every category and tag, click count, and meta.
 *
 * Navigation to the resource is funnelled through `onNavigate` (the card's
 * click-tracking) so opening the modal never counts as a click — only the
 * title link and the action button do.
 */
export function ResourceModal({
  resource,
  open,
  onOpenChange,
  onNavigate,
}: {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { has, toggle } = useFavorites();
  const { get } = useClickCounts();
  const { get: getFavorites } = useFavoriteCounts();
  const { register, get: getContributor } = useContributors();
  const { user, openAuth } = useAuth();
  const { categories: allCats, tags: allTags } = useTaxonomy(open);
  // Resolve a proposed slug to its existing title for display (free-text shows
  // the slug-ish token as-is).
  const titleForCat = (slug: string) =>
    allCats.find((c) => c.slug === slug)?.title ?? slug;
  const titleForTag = (slug: string) =>
    allTags.find((tg) => tg.slug === slug)?.title ?? slug;
  const icon = favicon(resource.url);
  const broken = resource.linkStatus === "broken";
  const fav = has(resource._id);
  const clicks = get(resource._id);
  const favorites = getFavorites(resource._id);

  // Broken-link fix suggestion (account-only, like submit/favorites).
  const [fixOpen, setFixOpen] = useState(false);
  const [fixUrl, setFixUrl] = useState("");
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixPending, setFixPending] = useState(false);
  // Category/tag fix editor (account-only).
  const [taxOpen, setTaxOpen] = useState(false);
  // Read-only view of the user's own pending suggestion.
  const [taxViewOpen, setTaxViewOpen] = useState(false);

  // A user may have one open taxonomy suggestion per resource. If a pending one
  // exists, we show it (read-only) instead of letting them suggest again.
  const { items: mySubmissions, loading: submissionsLoading, reload: reloadSubmissions } =
    useSubmissions();
  const pendingTaxFix = user
    ? mySubmissions.find(
        (s) =>
          s.kind === "taxonomy" &&
          s.target_resource_id === resource._id &&
          s.status === "pending",
      )
    : undefined;

  // Closing resets the inline forms.
  const change = (o: boolean) => {
    if (!o) {
      setFixOpen(false);
      setFixUrl("");
      setTaxOpen(false);
      setTaxViewOpen(false);
    }
    onOpenChange(o);
  };

  async function submitFix(e: React.FormEvent) {
    e.preventDefault();
    if (fixPending) return;
    const url = normalizeWebUrl(fixUrl);
    const error = !fixUrl.trim()
      ? t("validation.required")
      : !url
        ? t("validation.url")
        : url === normalizeWebUrl(resource.url)
          ? t("modal.fixSame")
          : null;
    setFixError(error);
    if (error || !url) return;
    setFixPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "fix",
          targetResourceId: resource._id,
          name: resource.name,
          url,
        }),
      });
      if (res.status === 403) {
        toast.error(t("verifyBanner.verifyFirst"));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("modal.fixSuccess"));
      setFixOpen(false);
      setFixUrl("");
    } catch {
      toast.error(t("modal.fixError"));
    } finally {
      setFixPending(false);
    }
  }

  useEffect(() => {
    if (open && resource.submittedBy) register(resource.submittedBy);
  }, [open, resource.submittedBy, register]);
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

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        className={cn(
          "max-h-[85vh] gap-6 overflow-y-auto p-4 sm:max-w-md",
          broken && "ring-destructive/50",
        )}
      >
        {/* Header — icon top-aligned so long, wrapping names read naturally */}
        <DialogHeader className="flex-row items-center gap-3.5 pr-6">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="size-6" loading="lazy" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base leading-snug">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onNavigate}
                onAuxClick={onNavigate}
                className="group underline-offset-4"
              >
                {/* Name and "Open Page" are one link, sitting on one baseline. */}
                <span className="group-hover:underline">{resource.name}</span>{" "}
                <span className="ml-1 inline-flex items-baseline gap-1 text-xs font-normal whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground group-hover:underline">
                  {t("company.openPage")}
                  <ExternalLink className="size-3 self-center" />
                </span>
              </a>
            </DialogTitle>
            {resource.author && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t("card.by", { author: resource.author })}
              </p>
            )}
            {/* For screen readers; the description is shown in the body. */}
            <DialogDescription className="sr-only">
              {resource.description || resource.name}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Status / language / pricing badges */}
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {broken && (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="size-3" /> {t("card.broken")}
            </Badge>
          )}
          {resource.language?.includes("tr") && (
            <Badge variant="outline">TR</Badge>
          )}
          {resource.pricing && (
            <Badge
              variant={resource.pricing === "free" ? "outline" : "secondary"}
            >
              {t(`pricing.${resource.pricing}`)}
            </Badge>
          )}
        </div>

        {/* Broken link → let signed-in users suggest a corrected URL. */}
        {broken && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            {!fixOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("modal.fixPrompt")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (user ? setFixOpen(true) : openAuth())}
                >
                  <Wrench className="size-3.5" />
                  {t("modal.fixCta")}
                </Button>
              </div>
            ) : (
              <form onSubmit={submitFix} noValidate className="space-y-2">
                <label htmlFor="fix-url" className="block text-xs font-medium text-foreground">
                  {t("modal.fixLabel")}
                </label>
                <Input
                  {...fieldProps("fix-url", fixError)}
                  inputMode="url"
                  autoFocus
                  value={fixUrl}
                  onChange={(e) => {
                    setFixUrl(e.target.value);
                    if (fixError) setFixError(null);
                  }}
                  placeholder="https://…"
                />
                {fixError && (
                  <p id="fix-url-error" role="alert" className="text-xs text-destructive">
                    {fixError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setFixOpen(false)}
                  >
                    {t("submissions.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={fixPending}
                    className="flex-1"
                  >
                    {fixPending && <Loader2 className="size-4 animate-spin" />}
                    {t("modal.fixSubmit")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {resource.description || t("modal.noDescription")}
        </p>

        {/* Categories & tags — editable via a taxonomy-fix suggestion. */}
        {taxOpen ? (
          <TaxonomyFixEditor
            resource={resource}
            onCancel={() => setTaxOpen(false)}
            onDone={() => {
              setTaxOpen(false);
              reloadSubmissions();
            }}
          />
        ) : taxViewOpen && pendingTaxFix ? (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
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
              onClick={() => change(false)}
              className="inline-flex items-center gap-1 self-end text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
            >
              {t("taxonomy.track")} <ArrowRight className="size-3" />
            </Link>
          </div>
        ) : (
          (resource.categories?.length > 0 || resource.tags?.length > 0) && (
            <div className="flex flex-col gap-4">
              {resource.categories?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("modal.categories")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resource.categories.map((cat) => (
                      <Link
                        key={cat._id}
                        href={`/category/${cat.slug}`}
                        onClick={() => change(false)}
                        className={PILL}
                      >
                        <CategoryIcon className="size-3.5" />
                        {cat.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {resource.tags?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("modal.tags")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resource.tags.map((tag) => (
                      <Link
                        key={tag._id}
                        href={`/tag/${tag.slug}`}
                        onClick={() => change(false)}
                        className={PILL}
                      >
                        {tag.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        <div className="flex flex-col gap-y-4">
          <Separator />

          {/* Meta: click count, favorite count, added date, contributor */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
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
                onClick={() => change(false)}
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

          {/* Actions — details · suggest edit · favorite, equal widths. Suggest
              edit turns into a "pending" button once the user has an open
              suggestion; the editor/read-only view render above this row. */}
          <div className="grid grid-cols-3 gap-2">
            {resource.slug ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`/resource/${resource.slug}`} onClick={() => change(false)}>
                  <Info />
                  {t("modal.details")}
                </Link>
              </Button>
            ) : (
              <span />
            )}

            {user && submissionsLoading ? (
              <Button variant="outline" size="lg" disabled>
                <Loader2 className="animate-spin" />
                <span className="truncate">{t("taxonomy.editShort")}</span>
              </Button>
            ) : pendingTaxFix ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setTaxViewOpen((o) => !o)}
                aria-pressed={taxViewOpen}
                title={t("taxonomy.pendingSuggestion")}
                className="min-w-0 text-amber-600 dark:text-amber-400"
              >
                <Clock />
                <span className="truncate">{t("taxonomy.pending")}</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => (user ? setTaxOpen((o) => !o) : openAuth())}
                aria-pressed={taxOpen}
                className="min-w-0"
              >
                <PencilLine />
                <span className="truncate">{t("taxonomy.editShort")}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                // Favorites are account-only — prompt sign-in for guests.
                if (!user) {
                  openAuth();
                  return;
                }
                toggle(resource._id);
              }}
              aria-pressed={fav}
              className={cn("min-w-0", fav && "border-primary/50 text-primary")}
            >
              <Star className={cn(fav && "fill-primary text-primary")} />
              <span className="truncate">{t(fav ? "card.favorited" : "card.favorite")}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
