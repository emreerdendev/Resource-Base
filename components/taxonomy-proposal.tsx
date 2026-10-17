"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type ChipState = "kept" | "added" | "removed";

/**
 * Read-only view of an edit suggestion: name/link changes as old → new, a
 * removal report on its own, and for taxonomy Diffs the proposed set against the
 * original (snapshot at submit time) and marks each value:
 *   - added   → primary border + dot
 *   - removed → destructive border + strikethrough (shown even though it's no
 *               longer in the proposed set, so the change is visible)
 *   - kept    → plain accent chip
 * Shared by the resource modal and the profile "my submissions" detail.
 */
export function TaxonomyProposal({
  categoriesLabel,
  tagsLabel,
  descriptionLabel,
  proposedCategories,
  proposedTags,
  proposedDescription,
  originalCategories,
  originalTags,
  originalDescription,
  resolveCategory = (s) => s,
  resolveTag = (s) => s,
  originalName,
  originalUrl,
  proposedName,
  proposedUrl,
  proposeRemoval = false,
  removalNote,
}: {
  categoriesLabel: string;
  tagsLabel: string;
  descriptionLabel?: string;
  proposedCategories: string[];
  proposedTags: string[];
  proposedDescription?: string | null;
  originalCategories: string[];
  originalTags: string[];
  originalDescription?: string | null;
  resolveCategory?: (slug: string) => string;
  resolveTag?: (slug: string) => string;
  originalName?: string | null;
  originalUrl?: string | null;
  proposedName?: string | null;
  proposedUrl?: string | null;
  /** Reported as gone — shown instead of any other change. */
  proposeRemoval?: boolean;
  removalNote?: string | null;
}) {
  const { t } = useTranslation();
  // A description change is shown only when one was actually proposed and it
  // differs from the snapshot taken at submit time.
  const descriptionChanged =
    proposedDescription != null &&
    proposedDescription.trim() !== (originalDescription ?? "").trim();
  // Older submissions (created before we snapshotted the original taxonomy)
  // have no baseline to diff against — show everything as plain "kept".
  const hasBaseline =
    originalCategories.length > 0 || originalTags.length > 0;

  // Build the ordered list of {slug, state} for a section: proposed items
  // first (added/kept), then any removed originals.
  const diff = (proposed: string[], original: string[]) => {
    const prop = new Set(proposed);
    const orig = new Set(original);
    const rows: { slug: string; state: ChipState }[] = proposed.map((s) => ({
      slug: s,
      state: hasBaseline && !orig.has(s) ? "added" : "kept",
    }));
    if (hasBaseline) {
      for (const s of original) {
        if (!prop.has(s)) rows.push({ slug: s, state: "removed" });
      }
    }
    return rows;
  };

  const catRows = diff(proposedCategories, originalCategories);
  const tagRows = diff(proposedTags, originalTags);
  const all = [...catRows, ...tagRows];
  const anyAdded =
    all.some((r) => r.state === "added") || descriptionChanged || !!proposedName || !!proposedUrl;
  const anyRemoved =
    all.some((r) => r.state === "removed") ||
    (descriptionChanged && !!(originalDescription ?? "").trim());

  if (proposeRemoval) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="font-medium">{t("taxonomy.removalProposed")}</p>
        {removalNote && <p className="mt-1 text-xs text-muted-foreground">{removalNote}</p>}
      </div>
    );
  }

  /** Old value struck through above the proposed one. */
  const change = (label: string, from: string | null | undefined, to: string) => (
    <Section label={label}>
      <div className="flex w-full flex-col gap-1.5">
        {from && (
          <p className="break-all rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-muted-foreground line-through">
            {from}
          </p>
        )}
        <p className="break-all rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          {to}
        </p>
      </div>
    </Section>
  );

  return (
    <div className="flex flex-col gap-3">
      {proposedName && change(t("submit.name"), originalName, proposedName)}
      {proposedUrl && change(t("submit.url"), originalUrl, proposedUrl)}
      {descriptionChanged && descriptionLabel && (
        <Section label={descriptionLabel}>
          <div className="flex flex-col gap-1.5">
            {(originalDescription ?? "").trim() && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-muted-foreground line-through">
                {originalDescription}
              </p>
            )}
            <p className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
              {proposedDescription}
            </p>
          </div>
        </Section>
      )}
      {catRows.length > 0 && (
        <Section label={categoriesLabel}>
          {catRows.map((r) => (
            <Chip key={`c-${r.slug}`} state={r.state}>
              {resolveCategory(r.slug)}
            </Chip>
          ))}
        </Section>
      )}
      {tagRows.length > 0 && (
        <Section label={tagsLabel}>
          {tagRows.map((r) => (
            <Chip key={`t-${r.slug}`} state={r.state}>
              {resolveTag(r.slug)}
            </Chip>
          ))}
        </Section>
      )}
      {(anyAdded || anyRemoved) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {anyAdded && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t("taxonomy.newLegend")}
            </span>
          )}
          {anyRemoved && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-destructive" />
              {t("taxonomy.removedLegend")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  state,
  children,
}: {
  state: ChipState;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        state === "added" &&
          "border border-emerald-500/60 bg-emerald-500/10 text-foreground",
        state === "removed" &&
          "border border-destructive/50 bg-destructive/10 text-muted-foreground line-through",
        state === "kept" && "bg-accent text-accent-foreground",
      )}
    >
      {state === "added" && (
        <span className="size-1.5 rounded-full bg-emerald-500" />
      )}
      {state === "removed" && (
        <span className="size-1.5 rounded-full bg-destructive" />
      )}
      {children}
    </span>
  );
}
