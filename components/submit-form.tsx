"use client";

import { useId, useState } from "react";
import { NavLink as Link } from "@/components/nav-link";
import { toast } from "sonner";
import { Globe, Hash, ListChecks, Loader2, Send, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconInput } from "@/components/ui/icon-input";
import { PricingSelect } from "@/components/pricing-select";
import { FormField } from "@/components/form-field";
import { normalizeWebUrl } from "@/lib/company-input";
import { useSubmissions } from "@/lib/submissions";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import type { Category, Pricing } from "@/lib/types";

const OTHER = "__other__";
/** /api/submit keeps at most this many tags. */
const MAX_TAGS = 10;

export function SubmitForm({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const id = useId();
  const { reload: reloadSubmissions } = useSubmissions();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [categoryChoice, setCategoryChoice] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [pricing, setPricing] = useState<Pricing | "">("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");

  const tagCount = tags.split(",").map((x) => x.trim()).filter(Boolean).length;
  // Same rules /api/submit enforces.
  const errors = {
    name: !name.trim()
      ? t("validation.required")
      : name.trim().length < 2
        ? t("validation.tooShort", { min: 2 })
        : null,
    url: !url.trim() ? t("validation.required") : normalizeWebUrl(url) ? null : t("validation.url"),
    customCategory:
      categoryChoice === OTHER && !customCategory.trim() ? t("validation.required") : null,
    tags: tagCount > MAX_TAGS ? t("validation.tooMany", { max: MAX_TAGS }) : null,
  };
  const form = useFormErrors(errors);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    // Honeypot: bots fill hidden fields.
    if (new FormData(el).get("company")) return;
    if (pending || !form.check(el)) return;

    // "Other" → use the free-text category the user typed.
    const suggestedCategory =
      categoryChoice === OTHER ? customCategory.trim() : categoryChoice;

    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Identity (user id + email) is taken from the verified server session
        // in /api/submit — never sent from the client.
        body: JSON.stringify({
          name: name.trim(),
          url: normalizeWebUrl(url),
          suggestedCategory,
          pricing,
          tags,
          note: note.trim(),
        }),
      });
      if (res.status === 403) {
        toast.error(t("verifyBanner.verifyFirst"));
        return;
      }
      if (res.status === 429) {
        toast.error(t("card.favoriteRateLimited"));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("submit.success"));
      reloadSubmissions();
      setName("");
      setUrl("");
      setCategoryChoice("");
      setCustomCategory("");
      setPricing("");
      setTags("");
      setNote("");
      form.reset();
    } catch {
      toast.error(t("submit.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("submit.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("submit.subtitle")}</p>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3"
          type="button"
        >
          <Link href="/submissions">
            <ListChecks className="size-3.5" />
            {t("submit.viewMine")}
          </Link>
        </Button>
      </div>
      <FormField id={`${id}-name`} label={t("submit.name")} required error={form.show("name")}>
        <IconInput
          {...fieldProps(`${id}-name`, form.show("name"))}
          icon={Type}
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => form.touch("name")}
          placeholder={t("submit.namePlaceholder")}
        />
      </FormField>
      <FormField id={`${id}-url`} label={t("submit.url")} required error={form.show("url")}>
        <IconInput
          {...fieldProps(`${id}-url`, form.show("url"))}
          icon={Globe}
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => {
            form.touch("url");
            const n = normalizeWebUrl(url);
            if (n) setUrl(n);
          }}
          placeholder="https://…"
        />
      </FormField>
      <FormField id={`${id}-category`} label={t("submit.category")} error={form.show("customCategory")}>
        <select
          id={`${id}-category`}
          value={categoryChoice}
          onChange={(e) => setCategoryChoice(e.target.value)}
          className="h-9 w-full cursor-pointer rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">{t("submit.selectCategory")}</option>
          {categories
            .filter((c) => !c.parentSlug)
            .map((c) => (
              <option key={c._id} value={c.title}>
                {c.title}
              </option>
            ))}
          <option value={OTHER}>{t("submit.otherCategory")}</option>
        </select>
        {categoryChoice === OTHER && (
          <div className="mt-2">
            <IconInput
              {...fieldProps(`${id}-custom`, form.show("customCategory"))}
              aria-label={t("submit.customCategoryPlaceholder")}
              icon={Type}
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              onBlur={() => form.touch("customCategory")}
              maxLength={60}
              placeholder={t("submit.customCategoryPlaceholder")}
              autoFocus
            />
          </div>
        )}
      </FormField>
      <div>
        <span className="mb-1.5 block text-sm font-medium">{t("submit.pricing")}</span>
        <PricingSelect value={pricing} onChange={setPricing} />
      </div>
      <FormField
        id={`${id}-tags`}
        label={t("submit.tags")}
        error={form.show("tags")}
        counter={`${tagCount}/${MAX_TAGS}`}
      >
        <IconInput
          {...fieldProps(`${id}-tags`, form.show("tags"))}
          icon={Hash}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => form.touch("tags")}
          placeholder={t("submit.tagsPlaceholder")}
        />
      </FormField>
      <FormField
        id={`${id}-note`}
        label={t("submit.note")}
        hint={t("submit.noteHint")}
        counter={`${note.length}/1000`}
      >
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("submit.notePlaceholder")}
        />
      </FormField>

      {/* Honeypot — hidden from humans, catches bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {t("submit.submit")}
      </Button>
    </form>
  );
}
