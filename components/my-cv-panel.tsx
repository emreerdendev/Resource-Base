"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Clock, EyeOff, Heart, Loader2, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMyCv, setCvListed, type MyCv } from "@/lib/cv-actions";
import { parseCvMeta } from "@/lib/cv-input";
import {
  CV_FIELDS,
  CV_LANGUAGES,
  CV_MAX_BYTES,
  CV_SENIORITIES,
  CV_SUMMARY_MAX,
  CV_TECH_SUGGESTIONS,
  CV_TITLE_MAX,
} from "@/lib/cv-taxonomy";
import { cn } from "@/lib/utils";

const STATUS_ICON = { pending: Clock, published: CheckCircle2, rejected: XCircle, hidden: EyeOff } as const;
const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  hidden: "border-border bg-muted text-muted-foreground",
};

/**
 * The CV tab of Edit Profile: upload, replace, unlist or delete your CV, and
 * see where its review stands. Rendered only for a signed-in user.
 */
export function MyCvPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cv, setCv] = useState<MyCv | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => setCv(await getMyCv()), []);
  useEffect(() => {
    if (user) getMyCv().then(setCv);
  }, [user]);

  if (cv === undefined) return <FormSkeleton fields={7} tall={[6]} />;

  async function setListed(listed: boolean) {
    setBusy(true);
    const { ok } = await setCvListed(listed).catch(() => ({ ok: false }));
    setBusy(false);
    if (!ok) return void toast.error(t("myCv.error.generic"));
    await reload();
  }

  async function remove() {
    if (!window.confirm(t("myCv.deleteConfirm"))) return;
    setBusy(true);
    const res = await fetch("/api/cv", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error(t("myCv.error.generic"));
    toast.success(t("myCv.deleted"));
    setEditing(false);
    await reload();
  }

  const Icon = cv ? STATUS_ICON[cv.status as keyof typeof STATUS_ICON] ?? Clock : Clock;

  return (
    <div>
      <p className="mb-6 text-sm text-muted-foreground">{t("myCv.subtitle")}</p>

      {cv && (
        <section className="mb-8 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{cv.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(`cvs.field.${cv.field}`)} · {t(`cvs.seniority.${cv.seniority}`)} ·{" "}
                {t(`cvs.language.${cv.language}`)} · {(cv.fileSize / 1024).toFixed(0)} KB
              </p>
            </div>
            <Badge variant="outline" className={cn("gap-1", STATUS_STYLE[cv.status])}>
              <Icon className="size-3" /> {t(`myCv.status.${cv.status}`)}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t(`myCv.statusHint.${cv.status}`)}</p>
          {cv.status === "rejected" && cv.rejectionReason && (
            <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <span className="font-medium">{t("submissions.reasonLabel")}: </span>
              {cv.rejectionReason}
            </p>
          )}
          {(cv.status === "published" || cv.status === "hidden") && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Heart className="size-3.5" /> {t("cvs.likes", { count: cv.likeCount })}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/cv/${cv.id}/file`} target="_blank" rel="noopener noreferrer">
                {t("myCv.view")}
              </a>
            </Button>
            {cv.status === "published" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setListed(false)}>
                {t("myCv.hide")}
              </Button>
            )}
            {cv.status === "hidden" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setListed(true)}>
                {t("myCv.show")}
              </Button>
            )}
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Upload className="size-3.5" /> {t("myCv.replace")}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
              {t("myCv.delete")}
            </Button>
          </div>
        </section>
      )}

      {(!cv || editing) && (
        <CvUploadForm
          initial={cv}
          onCancel={cv ? () => setEditing(false) : undefined}
          onDone={async () => {
            setEditing(false);
            await reload();
          }}
        />
      )}

      {!cv && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/cvs" className="text-primary hover:underline">
            {t("cvs.browse")}
          </Link>
        </p>
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  too_large: "myCv.error.tooLarge",
  not_pdf: "myCv.error.notPdf",
  unsafe: "myCv.error.unsafe",
  rate_limited: "myCv.error.rateLimited",
  consent: "myCv.error.consent",
  title: "myCv.error.title",
};

function CvUploadForm({
  initial,
  onCancel,
  onDone,
}: {
  initial: MyCv | null;
  onCancel?: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return void toast.error(t("myCv.error.notPdf"));
    if (file.size > CV_MAX_BYTES) return void toast.error(t("myCv.error.tooLarge"));
    const meta = parseCvMeta(Object.fromEntries(form));
    if (!meta.ok) return void toast.error(t(ERRORS[meta.error] ?? "myCv.error.generic"));
    if (form.get("consent") !== "yes") return void toast.error(t("myCv.error.consent"));

    setPending(true);
    try {
      const res = await fetch("/api/cv", { method: "POST", body: form });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(t(ERRORS[error ?? ""] ?? "myCv.error.generic"));
        return;
      }
      toast.success(t("myCv.success"));
      await onDone();
    } catch {
      toast.error(t("myCv.error.generic"));
    } finally {
      setPending(false);
    }
  }

  const field = (name: string, label: string, control: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={`${id}-${name}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {control}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  const select = (name: string, values: readonly string[], prefix: string, value?: string) => (
    <select
      id={`${id}-${name}`}
      name={name}
      required
      defaultValue={value ?? ""}
      className="h-9 w-full cursor-pointer rounded-md border border-border bg-background px-2 text-sm"
    >
      <option value="" disabled>
        —
      </option>
      {values.map((v) => (
        <option key={v} value={v}>
          {t(`${prefix}.${v}`)}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border p-4">
      {field(
        "file",
        t("myCv.form.file"),
        <Input id={`${id}-file`} name="file" type="file" accept="application/pdf,.pdf" required />,
        t("myCv.form.fileHint"),
      )}
      {field(
        "title",
        t("myCv.form.title"),
        <Input
          id={`${id}-title`}
          name="title"
          required
          minLength={2}
          maxLength={CV_TITLE_MAX}
          defaultValue={initial?.title}
          placeholder={t("myCv.form.titlePlaceholder")}
        />,
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("field", t("cvs.filter.field"), select("field", CV_FIELDS, "cvs.field", initial?.field))}
        {field(
          "seniority",
          t("cvs.filter.seniority"),
          select("seniority", CV_SENIORITIES, "cvs.seniority", initial?.seniority),
        )}
        {field(
          "language",
          t("cvs.filter.language"),
          select("language", CV_LANGUAGES, "cvs.language", initial?.language),
        )}
      </div>
      {field(
        "technologies",
        t("myCv.form.technologies"),
        <>
          <Input
            id={`${id}-technologies`}
            name="technologies"
            list={`${id}-tech-list`}
            defaultValue={initial?.technologies.join(", ")}
            placeholder={t("myCv.form.technologiesPlaceholder")}
          />
          <datalist id={`${id}-tech-list`}>
            {CV_TECH_SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </>,
      )}
      {field(
        "summary",
        t("myCv.form.summary"),
        <Textarea
          id={`${id}-summary`}
          name="summary"
          rows={3}
          maxLength={CV_SUMMARY_MAX}
          defaultValue={initial?.summary ?? ""}
          placeholder={t("myCv.form.summaryPlaceholder")}
        />,
      )}
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
        {t("myCv.form.privacyHint")}
      </p>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" name="consent" value="yes" required className="mt-0.5 size-4 cursor-pointer" />
        <span>
          {t("myCv.form.consent")}{" "}
          <Link href="/terms" target="_blank" className="text-primary hover:underline">
            {t("myCv.form.terms")}
          </Link>
        </span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {t("myCv.form.submit")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("submissions.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
