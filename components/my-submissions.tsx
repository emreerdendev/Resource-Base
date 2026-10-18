"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  FileText,
  Trash2,
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
import { CompanyEditProposal } from "@/components/company-edit-proposal";
import { ResubmitPanel } from "@/components/resubmit-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { ResourceGridSkeleton } from "@/components/skeletons";
import { normalizeWebUrl } from "@/lib/company-input";
import { fieldProps } from "@/lib/use-form-errors";
import { useAuth } from "@/components/auth/auth-provider";
import { getMyCv, type MyCv } from "@/lib/cv-actions";
import { withdrawSubmission } from "@/lib/data-actions";
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
type Group = "resources" | "edits" | "companies" | "cv";
const GROUPS: Group[] = ["resources", "edits", "companies", "cv"];

const groupOf = (s: Submission): Exclude<Group, "cv"> =>
  s.kind === "company" ? "companies" : s.kind === "new" ? "resources" : "edits";

/** CV status badge colours, matching the submission ones. */
const CV_STYLE: Record<string, string> = {
  pending: STATUS_STYLE.pending,
  published: STATUS_STYLE.approved,
  rejected: STATUS_STYLE.rejected,
  hidden: "border-border bg-muted text-muted-foreground",
};

/**
 * Everything the user has sent for review, kept apart by type — new
 * resources, edit suggestions (link fixes, edits, removal reports), companies
 * and their CV — with a filter row on top and one section per type.
 */
export function MySubmissions({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { items, loading, reload } = useSubmissions();
  const [open, setOpen] = useState<Submission | null>(null);
  const [group, setGroup] = useState<Group | "all">("all");
  // The CV lives in its own table; undefined while loading.
  const [cv, setCv] = useState<MyCv | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getMyCv()
      .then((v) => active && setCv(v))
      .catch(() => active && setCv(null));
    return () => {
      active = false;
    };
  }, [user]);

  if (loading || cv === undefined) {
    return <ResourceGridSkeleton count={6} />;
  }

  const counts: Record<Group, number> = {
    resources: items.filter((s) => groupOf(s) === "resources").length,
    edits: items.filter((s) => groupOf(s) === "edits").length,
    companies: items.filter((s) => groupOf(s) === "companies").length,
    cv: cv ? 1 : 0,
  };
  const total = items.length + counts.cv;

  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {t("submissions.empty")}
      </p>
    );
  }

  const shownGroups = GROUPS.filter((g) => counts[g] > 0 && (group === "all" || group === g));

  const card = (s: Submission) => {
    const icon = s.url ? favicon(s.url) : undefined;
    const sub =
      s.kind === "company"
        ? null
        : s.kind === "fix"
          ? t("submissions.urlFix")
          : s.kind === "taxonomy"
            ? t(s.propose_removal ? "submissions.removal" : "submissions.taxonomyFix")
            : s.kind === "companyEdit"
              ? t(s.propose_removal ? "submissions.removal" : "submissions.companyEdit")
              : null;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setOpen(s)}
        className="card-hover group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 text-left"
      >
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/50">
          {s.kind === "company" || s.kind === "companyEdit" ? (
            <Building2 className="size-5 text-muted-foreground" />
          ) : icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="size-5" loading="lazy" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-tight group-hover:underline">
            {s.name}
          </span>
          {sub && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wrench className="size-3" />
              {sub}
            </span>
          )}
        </span>
        <StatusBadge status={s.status} />
      </button>
    );
  };

  return (
    <>
      {/* Filter by type — only types the user actually has. */}
      <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label={t("submissions.title")}>
        {(["all", ...GROUPS] as const)
          .filter((g) => g === "all" || counts[g] > 0)
          .map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                group === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {t(`submissions.groups.${g}`)}
              <span className="ml-1.5 opacity-60">{g === "all" ? total : counts[g]}</span>
            </button>
          ))}
      </div>

      <div className="flex flex-col gap-8">
        {shownGroups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`submissions.groups.${g}`)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g === "cv" && cv ? (
                // One CV per user, so it gets a wider card with its details.
                <Link
                  href="/profile/edit?tab=cv"
                  className="card-hover group col-span-full flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight group-hover:underline">
                      {cv.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t(`cvs.field.${cv.field}`)} · {t(`cvs.seniority.${cv.seniority}`)} ·{" "}
                      {t(`cvs.language.${cv.language}`)}
                    </span>
                    <span className="mt-1.5 block text-sm text-muted-foreground">
                      {t(`myCv.statusHint.${cv.status}`)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Badge variant="outline" className={cn("gap-1", CV_STYLE[cv.status])}>
                      {t(`myCv.status.${cv.status}`)}
                    </Badge>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ) : (
                items.filter((s) => groupOf(s) === g).map(card)
              )}
            </div>
          </section>
        ))}
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
  const [errors, setErrors] = useState<FieldErrors>({});

  const known = categories.some(
    (c) => c.title === submission?.suggested_category,
  );
  // Live (approved) submissions are read-only; pending/rejected can be edited.
  // Only "new" resource submissions use the generic edit form here — URL and
  // taxonomy fixes are simple targeted corrections, kept read-only.
  const canEdit =
    submission?.status !== "approved" && submission?.kind === "new";
  // Rejected edit suggestions are edited in their own editor and sent again.
  const canResubmitEdit =
    submission?.status === "rejected" &&
    ["fix", "taxonomy", "companyEdit"].includes(submission.kind) &&
    Boolean(submission.sanity_submission_id);
  const [resubmitting, setResubmitting] = useState(false);

  // Reset per-open state whenever a different submission opens.
  const openId = submission?.id ?? null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (openId && openId !== seededFor) {
    setSeededFor(openId);
    setEditing(false);
    setResubmitting(false);
    setErrors({});
    setCategoryChoice(
      submission?.suggested_category
        ? known
          ? submission.suggested_category
          : OTHER
        : "",
    );
  }

  const [withdrawing, setWithdrawing] = useState(false);
  const { confirm, dialog } = useConfirm();
  async function withdraw() {
    if (!submission) return;
    const pendingOne = submission.status === "pending";
    const ok = await confirm({
      title: t(pendingOne ? "submissions.withdrawTitle" : "submissions.removeTitle"),
      description: t(pendingOne ? "submissions.withdrawConfirm" : "submissions.removeConfirm"),
      confirmLabel: t(pendingOne ? "submissions.withdraw" : "submissions.remove"),
      destructive: true,
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      const res = await withdrawSubmission(submission.id);
      if (!res.ok) {
        toast.error(
          t(
            res.error === "approved"
              ? "submissions.alreadyApproved"
              : res.error === "rate_limited"
                ? "card.favoriteRateLimited"
                : "submissions.withdrawError",
          ),
        );
        if (res.error === "approved") onDone(); // refresh to show the new status
        return;
      }
      toast.success(t(pendingOne ? "submissions.withdrawn" : "submissions.removed"));
      onDone();
    } catch {
      toast.error(t("submissions.withdrawError"));
    } finally {
      setWithdrawing(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!submission) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    // Same rules as /api/submit; shown inline, first invalid field focused.
    const found: FieldErrors = {
      name: (data.name ?? "").trim().length < 2 ? t("validation.tooShort", { min: 2 }) : undefined,
      url: normalizeWebUrl(data.url ?? "") ? undefined : t("validation.url"),
      customCategory:
        data.categoryChoice === OTHER && !(data.customCategory ?? "").trim()
          ? t("validation.required")
          : undefined,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    data.url = normalizeWebUrl(data.url)!;
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
                    className="group underline-offset-4"
                  >
                    {/* Same as the resource modal: name + "Open Page" as one link. */}
                    <span className="group-hover:underline">{s.name}</span>{" "}
                    <span className="ml-1 inline-flex items-baseline gap-1 text-xs font-normal whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground group-hover:underline">
                      {t("company.openPage")}
                      <ExternalLink className="size-3 self-center" />
                    </span>
                  </a>
                ) : (
                  s.name
                )}
              </DialogTitle>
              <StatusBadge status={s.status} />
            </DialogHeader>

            {resubmitting ? (
              <ResubmitPanel
                submission={s}
                onCancel={() => setResubmitting(false)}
                onDone={() => {
                  setResubmitting(false);
                  onDone();
                }}
              />
            ) : editing ? (
              <form
                onSubmit={onSubmit}
                noValidate
                className="space-y-4"
                // Editing a field clears its error.
                onChange={(e) => {
                  const name = (e.target as unknown as HTMLInputElement).name as keyof FieldErrors;
                  if (errors[name]) setErrors((x) => ({ ...x, [name]: undefined }));
                }}
              >
                <FormFields
                  errors={errors}
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
                    !!s.proposed_description ||
                    !!s.proposed_name ||
                    !!s.proposed_url ||
                    s.propose_removal) && (
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
                      originalName={s.name}
                      originalUrl={s.url}
                      proposedName={s.proposed_name}
                      proposedUrl={s.proposed_url}
                      proposeRemoval={s.propose_removal}
                      removalNote={s.note}
                      resolveCategory={(c) =>
                        categories.find((x) => x.slug === c)?.title ?? c
                      }
                    />
                  )}

                {s.kind === "companyEdit" && (
                  <CompanyEditProposal
                    proposed={s.proposed_fields}
                    original={s.original_fields}
                    proposeRemoval={s.propose_removal}
                    note={s.note}
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
                {s.note && s.kind !== "companyEdit" && (
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

                {s.kind === "company" && s.status === "rejected" && s.sanity_submission_id && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/submit/company?resubmit=${encodeURIComponent(s.sanity_submission_id)}`}>
                      {t("submissions.editResubmit")}
                    </Link>
                  </Button>
                )}
                {canResubmitEdit && (
                  <Button variant="outline" className="w-full" onClick={() => setResubmitting(true)}>
                    {t("submissions.editResubmit")}
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
                {/* Changed your mind? Pending ones leave the review queue;
                    rejected ones just leave your list. Approved ones are live. */}
                {s.status !== "approved" && (
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={withdrawing}
                    onClick={withdraw}
                  >
                    {withdrawing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    {t(s.status === "pending" ? "submissions.withdraw" : "submissions.remove")}
                  </Button>
                )}
              </>
            )}
          </>
        )}
        {dialog}
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
type FieldErrors = Partial<Record<"name" | "url" | "customCategory", string>>;

function FormFields({
  errors,
  submission,
  categories,
  categoryChoice,
  setCategoryChoice,
  known,
}: {
  errors: FieldErrors;
  submission: Submission;
  categories: Category[];
  categoryChoice: string;
  setCategoryChoice: (v: string) => void;
  known: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <FormField id={`${id}-name`} label={t("submit.name")} required error={errors.name}>
        <IconInput
          {...fieldProps(`${id}-name`, errors.name ?? null)}
          icon={Type}
          name="name"
          defaultValue={submission.name ?? ""}
          maxLength={200}
        />
      </FormField>
      <FormField id={`${id}-url`} label={t("submit.url")} required error={errors.url}>
        <IconInput
          {...fieldProps(`${id}-url`, errors.url ?? null)}
          icon={Globe}
          name="url"
          inputMode="url"
          defaultValue={submission.url ?? ""}
        />
      </FormField>
      <FormField id={`${id}-category`} label={t("submit.category")} error={errors.customCategory}>
        <select
          id={`${id}-category`}
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
              {...fieldProps(`${id}-custom`, errors.customCategory ?? null)}
              aria-label={t("submit.customCategoryPlaceholder")}
              icon={Type}
              name="customCategory"
              maxLength={60}
              defaultValue={known ? "" : (submission.suggested_category ?? "")}
              placeholder={t("submit.customCategoryPlaceholder")}
            />
          </div>
        )}
      </FormField>
      <div>
        <p className="mb-1.5 block text-sm font-medium">{t("submit.pricing")}</p>
        <PricingSelect defaultValue={submission.pricing ?? undefined} />
      </div>
      <div>
        <label htmlFor="resubmit-tags" className="mb-1.5 block text-sm font-medium">
          {t("submit.tags")}
        </label>
        <IconInput
          id="resubmit-tags"
          icon={Hash}
          name="tags"
          defaultValue={submission.tags.join(", ")}
          placeholder={t("submit.tagsPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="resubmit-note" className="mb-1.5 block text-sm font-medium">
          {t("submit.note")}
        </label>
        <Textarea
          id="resubmit-note"
          name="note"
          rows={3}
          defaultValue={submission.note ?? ""}
          placeholder={t("submit.notePlaceholder")}
        />
      </div>
    </>
  );
}
