"use client";

import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { useTaxonomy } from "@/components/taxonomy-provider";
import { normalizeWebUrl } from "@/lib/company-input";
import { fieldProps } from "@/lib/use-form-errors";
import { cn } from "@/lib/utils";
import type { Resource } from "@/lib/types";

/**
 * One selectable taxonomy value: either an existing doc (carries its slug +
 * title) or a free-text entry the user typed (slug === title === the text).
 */
type Picked = { slug: string; title: string };

/**
 * Inline editor for suggesting changes to a resource: its name, link,
 * description, categories and tags — or reporting it as gone. Users start from
 * the current values, add categories/tags from existing options (searchable)
 * or type new ones, then submit an edit suggestion that an editor reviews.
 */
export function TaxonomyFixEditor({
  resource,
  onCancel,
  onDone,
}: {
  resource: Resource;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { categories, tags } = useTaxonomy();
  const [pending, setPending] = useState(false);

  // Snapshot the resource's current taxonomy to detect "no change".
  const initialCats = useMemo(
    () => (resource.categories ?? []).map((c) => ({ slug: c.slug, title: c.title })),
    [resource.categories],
  );
  const initialTags = useMemo(
    () => (resource.tags ?? []).map((tg) => ({ slug: tg.slug, title: tg.title })),
    [resource.tags],
  );
  const initialDescription = resource.description ?? "";
  const [name, setName] = useState(resource.name);
  const [url, setUrl] = useState(resource.url);
  // "Gone / should be removed" replaces every other change.
  const [removal, setRemoval] = useState(false);
  const [reason, setReason] = useState("");
  const nameError =
    !removal && name.trim().length < 2 ? t("validation.tooShort", { min: 2 }) : null;
  const urlError = !removal && !normalizeWebUrl(url) ? t("validation.url") : null;
  const [cats, setCats] = useState<Picked[]>(initialCats);
  const [tagList, setTagList] = useState<Picked[]>(initialTags);
  const [description, setDescription] = useState(initialDescription);
  // Uncommitted input text — the user must add (+) or clear it before submitting.
  const [catQuery, setCatQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const hasPendingText = !!catQuery.trim() || !!tagQuery.trim();

  // Order-independent comparison of slug sets.
  const sameSet = (a: Picked[], b: Picked[]) => {
    if (a.length !== b.length) return false;
    const bs = new Set(b.map((p) => p.slug));
    return a.every((p) => bs.has(p.slug));
  };
  const descriptionChanged = description.trim() !== initialDescription.trim();
  const nameChanged = name.trim() !== resource.name;
  const urlChanged = (normalizeWebUrl(url) ?? url.trim()) !== resource.url;
  const dirty =
    removal ||
    nameChanged ||
    urlChanged ||
    !sameSet(cats, initialCats) ||
    !sameSet(tagList, initialTags) ||
    descriptionChanged;

  async function submit() {
    if (!dirty) return;
    if (!removal) {
      if (nameError || urlError) return; // shown inline
      // Categories/tags can both be emptied as long as a description is proposed.
      if (!cats.length && !tagList.length && !description.trim()) {
        toast.error(t("taxonomy.atLeastOne"));
        return;
      }
      if (hasPendingText) {
        toast.error(t("taxonomy.pendingText"));
        return;
      }
    }
    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "taxonomy",
          targetResourceId: resource._id,
          name: resource.name,
          // Carry the resource URL so the submission detail can link to it.
          url: resource.url,
          // Send slugs for existing, raw title for free-text — the webhook
          // resolves either against slug or title on approval.
          ...(removal
            ? { proposeRemoval: true, note: reason.trim() }
            : {
                proposedCategories: cats.map((c) => c.slug),
                proposedTags: tagList.map((tg) => tg.slug),
                // Only send what the user actually changed.
                ...(descriptionChanged && { proposedDescription: description.trim() }),
                ...(nameChanged && { proposedName: name.trim() }),
                ...(urlChanged && { proposedUrl: normalizeWebUrl(url) }),
              }),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("taxonomy.success"));
      onDone();
    } catch {
      toast.error(t("taxonomy.error"));
    } finally {
      setPending(false);
    }
  }

  const label = "text-xs font-medium tracking-wide text-muted-foreground uppercase";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-3">
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-sm">
        <input
          type="checkbox"
          checked={removal}
          onChange={(e) => setRemoval(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-destructive"
        />
        <span>
          <span className="font-medium">{t("taxonomy.removal")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("taxonomy.removalHint")}</span>
        </span>
      </label>
      {removal && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-reason`} className={label}>
            {t("taxonomy.removalReason")}
          </label>
          <Textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t("taxonomy.removalReasonPlaceholder")}
          />
        </div>
      )}
      {/* Every other field is locked while the resource is reported as gone. */}
      <fieldset disabled={removal} className={cn("flex flex-col gap-4", removal && "opacity-50")}>
      <FormField id={`${id}-name`} label={t("submit.name")} error={nameError}>
        <Input
          {...fieldProps(`${id}-name`, nameError)}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField id={`${id}-url`} label={t("submit.url")} error={urlError}>
        <Input
          {...fieldProps(`${id}-url`, urlError)}
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => {
            const n = normalizeWebUrl(url);
            if (n) setUrl(n);
          }}
        />
      </FormField>
      <div className="flex flex-col gap-1.5">
        <p className={label}>
          {t("taxonomy.description")}
        </p>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t("taxonomy.descriptionPlaceholder")}
        />
      </div>
      <TokenField
        label={t("modal.categories")}
        picked={cats}
        onChange={setCats}
        query={catQuery}
        onQueryChange={setCatQuery}
        options={categories.map((c) => ({ slug: c.slug, title: c.title }))}
        placeholder={t("taxonomy.addCategory")}
      />
      <TokenField
        label={t("modal.tags")}
        picked={tagList}
        onChange={setTagList}
        query={tagQuery}
        onQueryChange={setTagQuery}
        options={tags.map((tg) => ({ slug: tg.slug, title: tg.title }))}
        placeholder={t("taxonomy.addTag")}
      />
      {hasPendingText && (
        <p className="text-xs text-destructive">{t("taxonomy.pendingText")}</p>
      )}
      </fieldset>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCancel}
        >
          {t("submissions.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={pending || !dirty || (!removal && (hasPendingText || Boolean(nameError || urlError)))}
          onClick={submit}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("taxonomy.submit")}
        </Button>
      </div>
    </div>
  );
}

/** A label + chips of picked values + a searchable add input with suggestions. */
function TokenField({
  label,
  picked,
  onChange,
  query,
  onQueryChange,
  options,
  placeholder,
}: {
  label: string;
  picked: Picked[];
  onChange: (next: Picked[]) => void;
  query: string;
  onQueryChange: (q: string) => void;
  options: Picked[];
  placeholder: string;
}) {
  const setQuery = onQueryChange;

  const pickedSlugs = new Set(picked.map((p) => p.slug));
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (o) => !pickedSlugs.has(o.slug) && o.title.toLowerCase().includes(q),
      )
      .slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options, picked]);

  const add = (p: Picked) => {
    if (pickedSlugs.has(p.slug)) return;
    onChange([...picked, p]);
    setQuery("");
  };

  // Turn free text into a slug-ish token (matches Sanity slugs well enough for
  // the webhook's slug-or-title resolution).
  const addFreeText = () => {
    const title = query.trim();
    if (!title) return;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || pickedSlugs.has(slug)) {
      setQuery("");
      return;
    }
    add({ slug, title });
  };

  const remove = (slug: string) =>
    onChange(picked.filter((p) => p.slug !== slug));

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <span
              key={p.slug}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
            >
              {p.title}
              <button
                type="button"
                aria-label="remove"
                onClick={() => remove(p.slug)}
                className="cursor-pointer rounded-full text-accent-foreground/60 transition-colors hover:text-accent-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0]);
              else addFreeText();
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        {query.trim() && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            {suggestions.map((o) => (
              <button
                key={o.slug}
                type="button"
                onClick={() => add(o)}
                className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                {o.title}
              </button>
            ))}
            <button
              type="button"
              onClick={addFreeText}
              className={cn(
                "flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted",
                suggestions.length > 0 && "border-t border-border",
              )}
            >
              <Plus className="size-3.5" />“{query.trim()}”
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
