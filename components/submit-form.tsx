"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Globe, Hash, ListChecks, Loader2, Send, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconInput } from "@/components/ui/icon-input";
import { PricingSelect } from "@/components/pricing-select";
import { useSubmissions } from "@/lib/submissions";
import type { Category, Pricing } from "@/lib/types";

const OTHER = "__other__";

export function SubmitForm({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const { reload: reloadSubmissions } = useSubmissions();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [categoryChoice, setCategoryChoice] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [pricing, setPricing] = useState<Pricing | "">("");

  // Required fields must be filled and the URL well-formed before submitting;
  // when "Other" is chosen, its free-text category is also required.
  const urlValid = /^https?:\/\/.+\..+/.test(url.trim());
  const categoryValid = categoryChoice !== OTHER || customCategory.trim().length > 0;
  const canSubmit =
    !pending && name.trim().length > 0 && urlValid && categoryValid;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // Honeypot: bots fill hidden fields.
    if (data.company) return;

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
          url: url.trim(),
          suggestedCategory,
          pricing: data.pricing,
          tags: data.tags,
          note: data.note,
        }),
      });
      if (res.status === 429) {
        toast.error(t("card.favoriteRateLimited"));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("submit.success"));
      reloadSubmissions();
      form.reset();
      setName("");
      setUrl("");
      setCategoryChoice("");
      setCustomCategory("");
      setPricing("");
    } catch {
      toast.error(t("submit.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.name")} *
        </label>
        <IconInput icon={Type} name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Tailwind CSS" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.url")} *
        </label>
        <IconInput icon={Globe} name="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.category")}
        </label>
        <select
          name="categoryChoice"
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
              icon={Type}
              name="customCategory"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              required
              maxLength={60}
              placeholder={t("submit.customCategoryPlaceholder")}
              autoFocus
            />
          </div>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.pricing")}
        </label>
        <PricingSelect value={pricing} onChange={setPricing} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.tags")}
        </label>
        <IconInput icon={Hash} name="tags" placeholder={t("submit.tagsPlaceholder")} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.note")}
        </label>
        <Textarea
          name="note"
          rows={3}
          placeholder={t("submit.notePlaceholder")}
        />
      </div>

      {/* Honeypot — hidden from humans, catches bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <Button type="submit" disabled={!canSubmit} size="lg" className="w-full">
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
