"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Clock, EyeOff, FileText, Heart, Loader2, Send, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { FormField } from "@/components/form-field";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMyCv, setCvListed, type MyCv } from "@/lib/cv-actions";
import { forgetCvListing } from "@/lib/cv-listing";
import { parseCvMeta } from "@/lib/cv-input";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import {
  CV_FIELDS,
  CV_LANGUAGES,
  CV_MAX_BYTES,
  CV_MAX_TECHNOLOGIES,
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
    forgetCvListing();
    await reload();
  }

  async function remove() {
    if (!window.confirm(t("myCv.deleteConfirm"))) return;
    setBusy(true);
    const res = await fetch("/api/cv", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error(t("myCv.error.generic"));
    toast.success(t("myCv.deleted"));
    forgetCvListing();
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
            {/* Next to the status: where the review is tracked. */}
            <div className="flex items-center gap-3">
            <Link
              href="/submissions"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <Send className="size-3" /> {t("myCv.track")}
            </Link>
            <Badge variant="outline" className={cn("gap-1", STATUS_STYLE[cv.status])}>
              <Icon className="size-3" /> {t(`myCv.status.${cv.status}`)}
            </Badge>
            </div>
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
            forgetCvListing();
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

/** API error codes → messages. */
const API_ERRORS: Record<string, string> = {
  too_large: "validation.fileSize",
  not_pdf: "validation.fileType",
  unsafe: "myCv.error.unsafe",
  rate_limited: "myCv.error.rateLimited",
  unverified: "verifyBanner.verifyFirst",
  consent: "validation.consent",
};

const SELECT =
  "h-9 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

/** Is this file worth sending? Checks type, size and the %PDF header locally. */
async function fileError(file: File | null): Promise<string | null> {
  if (!file) return "validation.fileRequired";
  if (file.size > CV_MAX_BYTES) return "validation.fileSize";
  const head = new TextDecoder("latin1").decode(await file.slice(0, 1024).arrayBuffer());
  return head.includes("%PDF-") ? null : "validation.fileType";
}

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
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>("validation.fileRequired");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [field, setField] = useState(initial?.field ?? "");
  const [seniority, setSeniority] = useState(initial?.seniority ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "");
  const [tech, setTech] = useState(initial?.technologies.join(", ") ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [consent, setConsent] = useState(false);

  const techCount = tech.split(",").map((x) => x.trim()).filter(Boolean).length;
  const errors = {
    file: fileErr ? t(fileErr) : null,
    title: !title.trim()
      ? t("validation.required")
      : title.trim().length < 2
        ? t("validation.tooShort", { min: 2 })
        : null,
    field: field ? null : t("validation.choose"),
    seniority: seniority ? null : t("validation.choose"),
    language: language ? null : t("validation.choose"),
    tech: techCount > CV_MAX_TECHNOLOGIES ? t("validation.tooMany", { max: CV_MAX_TECHNOLOGIES }) : null,
    consent: consent ? null : t("validation.consent"),
  };
  const form = useFormErrors(errors);

  async function pickFile(next: File | null) {
    setFile(next);
    form.touch("file");
    setFileErr(await fileError(next));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !form.check(e.currentTarget)) return;
    const meta = parseCvMeta({ title, field, seniority, language, technologies: tech, summary });
    if (!meta.ok || !file) return; // already covered by the inline errors

    const body = new FormData();
    body.set("file", file);
    body.set("consent", "yes");
    for (const [k, v] of Object.entries(meta.value)) {
      if (v !== null) body.set(k, Array.isArray(v) ? v.join(",") : v);
    }
    setPending(true);
    try {
      const res = await fetch("/api/cv", { method: "POST", body });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(t(API_ERRORS[error ?? ""] ?? "myCv.error.generic"));
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

  const select = (
    name: "field" | "seniority" | "language",
    values: readonly string[],
    prefix: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <select
      {...fieldProps(`${id}-${name}`, form.show(name))}
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={() => form.touch(name)}
      className={SELECT}
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
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border border-border p-4">
      <FormField id={`${id}-file`} label={t("myCv.form.file")} required hint={t("myCv.form.fileHint")} error={form.show("file")}>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors hover:border-primary/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            form.show("file") ? "border-destructive" : "border-input",
          )}
        >
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            {file ? (
              <>
                {file.name}{" "}
                <span className="text-muted-foreground">· {(file.size / 1024).toFixed(0)} KB</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("validation.noFile")}</span>
            )}
          </span>
          <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium">
            {t(file ? "validation.changeFile" : "validation.chooseFile")}
          </span>
          <input
            {...fieldProps(`${id}-file`, form.show("file"), true)}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </FormField>

      <FormField
        id={`${id}-title`}
        label={t("myCv.form.title")}
        required
        error={form.show("title")}
        counter={`${title.length}/${CV_TITLE_MAX}`}
      >
        <Input
          {...fieldProps(`${id}-title`, form.show("title"))}
          value={title}
          maxLength={CV_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => form.touch("title")}
          placeholder={t("myCv.form.titlePlaceholder")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${id}-field`} label={t("cvs.filter.field")} required error={form.show("field")}>
          {select("field", CV_FIELDS, "cvs.field", field, setField)}
        </FormField>
        <FormField id={`${id}-seniority`} label={t("cvs.filter.seniority")} required error={form.show("seniority")}>
          {select("seniority", CV_SENIORITIES, "cvs.seniority", seniority, setSeniority)}
        </FormField>
        <FormField id={`${id}-language`} label={t("cvs.filter.language")} required error={form.show("language")}>
          {select("language", CV_LANGUAGES, "cvs.language", language, setLanguage)}
        </FormField>
      </div>

      <FormField
        id={`${id}-tech`}
        label={t("myCv.form.technologies")}
        error={form.show("tech")}
        counter={`${techCount}/${CV_MAX_TECHNOLOGIES}`}
      >
        <Input
          {...fieldProps(`${id}-tech`, form.show("tech"))}
          list={`${id}-tech-list`}
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          onBlur={() => form.touch("tech")}
          placeholder={t("myCv.form.technologiesPlaceholder")}
        />
        <datalist id={`${id}-tech-list`}>
          {CV_TECH_SUGGESTIONS.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </FormField>

      <FormField
        id={`${id}-summary`}
        label={t("myCv.form.summary")}
        counter={`${summary.length}/${CV_SUMMARY_MAX}`}
      >
        <Textarea
          id={`${id}-summary`}
          rows={3}
          maxLength={CV_SUMMARY_MAX}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t("myCv.form.summaryPlaceholder")}
        />
      </FormField>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
        {t("myCv.form.privacyHint")}
      </p>

      <FormField id={`${id}-consent`} error={form.show("consent")}>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            {...fieldProps(`${id}-consent`, form.show("consent"))}
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              form.touch("consent");
            }}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
          />
          <span>
            {t("myCv.form.consent")}{" "}
            <Link href="/terms" target="_blank" className="text-primary hover:underline">
              {t("myCv.form.terms")}
            </Link>
          </span>
        </label>
      </FormField>

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
