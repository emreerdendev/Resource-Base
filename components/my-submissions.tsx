"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Hash,
  Loader2,
  Type,
  Wrench,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconInput } from "@/components/ui/icon-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingSelect } from "@/components/pricing-select";
import { TaxonomyProposal } from "@/components/taxonomy-proposal";
import { useSubmissions } from "@/lib/submissions";
import { cn, favicon } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import type { Category, Submission, SubmissionStatus } from "@/lib/types";

const OTHER = "__other__";

/** True only for real http(s) links — taxonomy fixes have no URL of their own. */
function isHttpUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<SubmissionStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

/** Pill shared with the resource modal. */
const PILL =
  "inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground";

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { t } = useTranslation();
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant="outline" className={cn("gap-1 shrink-0", STATUS_STYLE[status])}>
      <Icon className="size-3" />
      {t(`submissions.status.${status}`)}
    </Badge>
  );
}

/**
 * Owner-only list of the user's submissions. Each card opens a detail modal
 * (like the home resource cards) showing status + everything submitted, with
 * an inline edit/resubmit form for items still in the queue or rejected.
 */
export function MySubmissions({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const { items, loading, reload } = useSubmissions();
  const [open, setOpen] = useState<Submission | null>(null);

  if (loading) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {t("submissions.empty")}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const icon = s.url ? favicon(s.url) : undefined;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpen(s)}
              className="card-hover group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/50">
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt="" className="size-5" loading="lazy" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-tight group-hover:underline">
                  {s.name}
                </span>
                {s.kind === "company" ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building2 className="size-3" />
                    {t("submissions.company")}
                  </span>
                ) : s.kind !== "new" && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Wrench className="size-3" />
                    {t(
                      s.kind === "fix"
                        ? "submissions.urlFix"
                        : "submissions.taxonomyFix",
                    )}
                  </span>
                )}
              </span>
              <StatusBadge status={s.status} />
            </button>
          );
        })}
      </div>

      <SubmissionDialog
        submission={open}
        categories={categories}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          reload();
        }}
      />
    </>
  );
}

function SubmissionDialog({
  submission,
  categories,
  onClose,
  onDone,
}: {
  submission: Submission | null;
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categoryChoice, setCategoryChoice] = useState("");

  const known = categories.some(
    (c) => c.title === submission?.suggested_category,
  );
  // Live (approved) submissions are read-only; pending/rejected can be edited.
  // Only "new" resource submissions use the generic edit form here — URL and
  // taxonomy fixes are simple targeted corrections, kept read-only.
  const canEdit =
    submission?.status !== "approved" && submission?.kind === "new";

  // Reset per-open state whenever a different submission opens.
  const openId = submission?.id ?? null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (openId && openId !== seededFor) {
    setSeededFor(openId);
    setEditing(false);
    setCategoryChoice(
      submission?.suggested_category
        ? known
          ? submission.suggested_category
          : OTHER
        : "",
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submission) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const suggestedCategory =
      data.categoryChoice === OTHER
        ? (data.customCategory ?? "").trim()
        : (data.categoryChoice ?? "");

    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.sanity_submission_id,
          name: data.name,
          url: data.url,
          suggestedCategory,
          pricing: data.pricing,
          tags: data.tags,
          note: data.note,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("submissions.resubmitSuccess"));
      onDone();
    } catch {
      toast.error(t("submissions.resubmitError"));
    } finally {
      setPending(false);
    }
  }

  const s = submission;

  return (
    <Dialog open={!!submission} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        {s && (
          <>
            <DialogHeader className="flex-row items-center gap-3 pr-6">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/50">
                {s.url && favicon(s.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favicon(s.url)}
                    alt=""
                    className="size-5"
                    loading="lazy"
                  />
                ) : null}
              </span>
              <DialogTitle className="min-w-0 flex-1 text-base leading-snug">
                {isHttpUrl(s.url) ? (
                  <a
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {s.name}
                    <ArrowUpRight className="ml-1 inline size-3.5 align-baseline opacity-60" />
                  </a>
                ) : (
                  s.name
                )}
              </DialogTitle>
              <StatusBadge status={s.status} />
            </DialogHeader>

            {editing ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <FormFields
                  submission={s}
                  categories={categories}
                  categoryChoice={categoryChoice}
                  setCategoryChoice={setCategoryChoice}
                  known={known}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditing(false)}
                  >
                    {t("submissions.cancel")}
                  </Button>
                  <Button type="submit" disabled={pending} className="flex-1">
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    {t("submissions.resubmit")}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Taxonomy fix: show proposals with new items highlighted. */}
                {s.kind === "taxonomy" &&
                  (s.proposed_categories.length > 0 ||
                    s.proposed_tags.length > 0 ||
                    !!s.proposed_description) && (
                    <TaxonomyProposal
                      categoriesLabel={t("modal.categories")}
                      tagsLabel={t("modal.tags")}
                      descriptionLabel={t("taxonomy.description")}
                      proposedCategories={s.proposed_categories}
                      proposedTags={s.proposed_tags}
                      proposedDescription={s.proposed_description}
                      originalCategories={s.original_categories}
                      originalTags={s.original_tags}
                      originalDescription={s.original_description}
                      resolveCategory={(c) =>
                        categories.find((x) => x.slug === c)?.title ?? c
                      }
                    />
                  )}

                {/* New-resource submissions — mirror the home modal layout:
                    pricing on its own badge row, tags in a labelled section. */}
                {s.kind !== "taxonomy" && s.pricing && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={s.pricing === "free" ? "outline" : "secondary"}
                    >
                      {t(`pricing.${s.pricing}`)}
                    </Badge>
                  </div>
                )}

                {s.kind !== "taxonomy" && s.suggested_category && (
                  <DetailRow
                    label={t("submit.category")}
                    value={s.suggested_category}
                  />
                )}

                {s.kind !== "taxonomy" && s.tags.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("modal.tags")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {s.tags.map((tag) => (
                        <span key={tag} className={PILL}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {s.note && (
                  <DetailRow label={t("submit.note")} value={s.note} />
                )}

                {/* Rejection reason */}
                {s.status === "rejected" && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-sm text-muted-foreground">
                      {s.rejection_reason ? (
                        <>
                          <span className="font-medium text-foreground">
                            {t("submissions.reasonLabel")}:{" "}
                          </span>
                          {s.rejection_reason}
                        </>
                      ) : (
                        t("submissions.noReason")
                      )}
                    </p>
                  </div>
                )}

                {s.kind === "company" && s.status === "rejected" && s.name && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/submit?type=company&name=${encodeURIComponent(s.name)}`}>
                      {t("submissions.suggestAgain")}
                    </Link>
                  </Button>
                )}
                {s.kind === "company" && s.status === "approved" && s.name && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/company/${slugify(s.name)}`}>
                      {s.name} <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditing(true)}
                  >
                    {s.status === "rejected"
                      ? t("submissions.editResubmit")
                      : t("submissions.edit")}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

/** Shared edit fields for the resubmit form. */
function FormFields({
  submission,
  categories,
  categoryChoice,
  setCategoryChoice,
  known,
}: {
  submission: Submission;
  categories: Category[];
  categoryChoice: string;
  setCategoryChoice: (v: string) => void;
  known: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.name")} *
        </label>
        <IconInput
          icon={Type}
          name="name"
          required
          defaultValue={submission.name ?? ""}
          maxLength={200}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.url")} *
        </label>
        <IconInput
          icon={Globe}
          name="url"
          type="url"
          required
          defaultValue={submission.url ?? ""}
        />
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
              required
              maxLength={60}
              defaultValue={known ? "" : (submission.suggested_category ?? "")}
              placeholder={t("submit.customCategoryPlaceholder")}
            />
          </div>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.pricing")}
        </label>
        <PricingSelect defaultValue={submission.pricing ?? undefined} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.tags")}
        </label>
        <IconInput
          icon={Hash}
          name="tags"
          defaultValue={submission.tags.join(", ")}
          placeholder={t("submit.tagsPlaceholder")}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          {t("submit.note")}
        </label>
        <Textarea
          name="note"
          rows={3}
          defaultValue={submission.note ?? ""}
          placeholder={t("submit.notePlaceholder")}
        />
      </div>
    </>
  );
}
