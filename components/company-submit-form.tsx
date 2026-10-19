"use client";

import { useEffect, useId, useState } from "react";
import { NavLink as Link } from "@/components/nav-link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  Building2,
  Globe,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LinkedinIcon } from "@/components/brand-icons";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_OTHER_LOCATIONS,
  normalizeEmail,
  normalizeLinkedinJobsUrl,
  normalizeLocation,
  normalizeWebUrl,
} from "@/lib/company-input";
import { CITIES, WORK_MODELS, type City, type WorkModel } from "@/lib/company-taxonomy";
import { useSubmissions } from "@/lib/submissions";
import { getResubmitContext } from "@/lib/data-actions";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import { cn } from "@/lib/utils";

const CHIP =
  "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors";
const chipClass = (active: boolean) =>
  cn(
    CHIP,
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background hover:bg-muted",
  );

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  label: (v: T) => string;
}) {
  return (
    <>
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}
            className={chipClass(active)}
          >
            {label(o)}
          </button>
        );
      })}
    </>
  );
}

/** Field + its inline validation message. */
function Field({ error, children }: { error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const splitEmails = (v: string) => v.split(/[,;\s]+/).filter(Boolean);

/**
 * Suggest a company for the directory. Every suggestion is reviewed; on
 * approval the company goes live automatically and the submitter is notified.
 * Inputs are validated as you go and tidied on blur (e.g. a LinkedIn company
 * page becomes its /jobs/ tab); the API re-checks everything.
 */
export function CompanySubmitForm({
  initialName = "",
  resubmitId,
}: {
  initialName?: string;
  /** A rejected company suggestion to edit and send again (from My Submissions). */
  resubmitId?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const router = useRouter();
  const { reload: reloadSubmissions } = useSubmissions();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState("");
  const [careerUrl, setCareerUrl] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [emails, setEmails] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [others, setOthers] = useState<string[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");
  const [otherError, setOtherError] = useState<string | null>(null);
  const [workModels, setWorkModels] = useState<WorkModel[]>([]);
  const [note, setNote] = useState("");
  const [replaces, setReplaces] = useState<string | null>(null);

  // Resubmitting: start from the rejected suggestion's values.
  useEffect(() => {
    if (!resubmitId) return;
    let active = true;
    getResubmitContext(resubmitId)
      .then((ctx) => {
        if (!active || ctx?.kind !== "company") return;
        const f = ctx.fields;
        setName(f.name);
        setWebsite(f.website);
        setCareerUrl(f.careerUrl);
        setLinkedin(f.linkedin);
        setEmails(f.emails.join(", "));
        setCities(f.cities.filter((c): c is City => (CITIES as readonly string[]).includes(c)));
        setOthers(f.otherLocations);
        setWorkModels(f.workModels.filter((w): w is WorkModel => (WORK_MODELS as readonly string[]).includes(w)));
        setNote(f.note);
        setReplaces(resubmitId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [resubmitId]);

  const urlError = (v: string) => (v.trim() && !normalizeWebUrl(v) ? t("suggest.invalidUrl") : null);
  const linkedinError =
    linkedin.trim() && !normalizeLinkedinJobsUrl(linkedin) ? t("suggest.invalidLinkedin") : null;
  const emailList = splitEmails(emails);
  const emailError =
    emailList.some((e) => !normalizeEmail(e)) || emailList.length > 5
      ? t("suggest.invalidEmail")
      : null;
  const hasWay = Boolean(website.trim() || careerUrl.trim() || linkedin.trim() || emailList.length);
  // Same rules /api/submit enforces (lib/company-submission.ts).
  const errors = {
    name: !name.trim()
      ? t("validation.required")
      : name.trim().length < 2
        ? t("validation.tooShort", { min: 2 })
        : null,
    website: urlError(website),
    careerUrl: urlError(careerUrl),
    linkedin: linkedinError,
    emails: emailError,
    ways: hasWay ? null : t("suggest.waysHint"),
  };
  const form = useFormErrors(errors);
  const touch = form.touch;

  /** Replace a field's value with its normalized form when it's valid. */
  const tidy = (k: keyof typeof errors, v: string, set: (v: string) => void, fn: (v: string) => string | null) => {
    touch(k);
    const n = v.trim() ? fn(v) : null;
    if (n) set(n);
  };

  function addOther() {
    const loc = normalizeLocation(otherDraft);
    if (!loc) return setOtherError(t("suggest.invalidLocation"));
    if ("city" in loc) {
      if (!cities.includes(loc.city)) setCities([...cities, loc.city]);
    } else if (!others.includes(loc.other)) {
      if (others.length >= MAX_OTHER_LOCATIONS)
        return setOtherError(t("suggest.tooManyLocations", { count: MAX_OTHER_LOCATIONS }));
      setOthers([...others, loc.other]);
    }
    setOtherDraft("");
    setOtherError(null);
  }

  function reset() {
    setName("");
    setWebsite("");
    setCareerUrl("");
    setLinkedin("");
    setEmails("");
    setCities([]);
    setOthers([]);
    setOtherOpen(false);
    setOtherDraft("");
    setWorkModels([]);
    setNote("");
    form.reset();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Honeypot: bots fill hidden fields.
    if (new FormData(e.currentTarget).get("company")) return;
    if (pending || !form.check(e.currentTarget)) return;

    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "company",
          ...(replaces && { replaces }),
          name: name.trim(),
          website: website.trim() && normalizeWebUrl(website),
          careerUrl: careerUrl.trim() && normalizeWebUrl(careerUrl),
          linkedin: linkedin.trim() && normalizeLinkedinJobsUrl(linkedin),
          emails: emailList.map((x) => normalizeEmail(x)).join(","),
          cities,
          otherLocations: others,
          workModels,
          note: note.trim(),
        }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; slug?: string };
        if (body.error === "exists" && body.slug) {
          toast.info(t("suggest.exists"), {
            action: {
              label: t("suggest.view"),
              onClick: () => router.push(`/company/${body.slug}`),
            },
          });
        } else {
          toast.info(t("suggest.alreadyPending"));
        }
        return;
      }
      if (res.status === 403) {
        toast.error(t("verifyBanner.verifyFirst"));
        return;
      }
      if (res.status === 429) {
        toast.error(t("card.favoriteRateLimited"));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("suggest.success"));
      reloadSubmissions();
      reset();
      if (replaces) {
        setReplaces(null);
        router.push("/submissions");
      }
    } catch {
      toast.error(t("submit.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("suggest.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("suggest.subtitle")}</p>
        <Button asChild variant="outline" size="sm" className="mt-3" type="button">
          <Link href="/submissions">
            <ListChecks className="size-3.5" />
            {t("submit.viewMine")}
          </Link>
        </Button>
      </div>

      <FormField id={`${id}-name`} label={t("suggest.name")} required error={form.show("name")}>
        <IconInput
          {...fieldProps(`${id}-name`, form.show("name"))}
          icon={Building2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch("name")}
          maxLength={120}
          placeholder={t("suggest.namePlaceholder")}
        />
      </FormField>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("company.howToApply")} *</legend>
        <p
          className={cn(
            "-mt-1 text-xs",
            form.show("ways") ? "text-destructive" : "text-muted-foreground",
          )}
          role={form.show("ways") ? "alert" : undefined}
        >
          {t("suggest.waysHint")}
        </p>
        <Field error={form.show("emails")}>
          <IconInput
            icon={Mail}
            value={emails}
            inputMode="email"
            onChange={(e) => setEmails(e.target.value)}
            onBlur={() => {
              touch("emails");
              if (!emailError) setEmails(emailList.map((x) => normalizeEmail(x)).join(", "));
            }}
            placeholder={t("suggest.emailsPlaceholder")}
            aria-invalid={Boolean(form.show("emails"))}
            aria-label={t("suggest.emails")}
          />
        </Field>
        <Field error={form.show("careerUrl")}>
          <IconInput
            icon={Briefcase}
            value={careerUrl}
            inputMode="url"
            onChange={(e) => setCareerUrl(e.target.value)}
            onBlur={() => tidy("careerUrl", careerUrl, setCareerUrl, normalizeWebUrl)}
            placeholder={t("suggest.careerPlaceholder")}
            aria-invalid={Boolean(form.show("careerUrl"))}
            aria-label={t("suggest.career")}
          />
        </Field>
        <Field error={form.show("linkedin")}>
          <IconInput
            icon={LinkedinIcon}
            value={linkedin}
            inputMode="url"
            onChange={(e) => setLinkedin(e.target.value)}
            onBlur={() => tidy("linkedin", linkedin, setLinkedin, normalizeLinkedinJobsUrl)}
            placeholder="https://www.linkedin.com/company/…"
            aria-invalid={Boolean(form.show("linkedin"))}
            aria-label="LinkedIn"
          />
        </Field>
        <Field error={form.show("website")}>
          <IconInput
            icon={Globe}
            value={website}
            inputMode="url"
            onChange={(e) => setWebsite(e.target.value)}
            onBlur={() => tidy("website", website, setWebsite, normalizeWebUrl)}
            placeholder={t("suggest.websitePlaceholder")}
            aria-invalid={Boolean(form.show("website"))}
            aria-label={t("suggest.website")}
          />
        </Field>
        <p className="text-[11px] text-muted-foreground">{t("suggest.privacyHint")}</p>
      </fieldset>

      <div>
        <p className="mb-1.5 text-sm font-medium">{t("suggest.locations")}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chips
            options={CITIES}
            value={cities}
            onChange={setCities}
            label={(c) => t(`companies.city.${c}`)}
          />
          {others.map((o) => (
            <span key={o} className={cn(chipClass(true), "inline-flex cursor-default items-center gap-1")}>
              {o}
              <button
                type="button"
                onClick={() => setOthers(others.filter((x) => x !== o))}
                aria-label={t("suggest.removeLocation", { place: o })}
                className="cursor-pointer opacity-80 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-expanded={otherOpen}
            onClick={() => setOtherOpen((v) => !v)}
            className={cn(chipClass(otherOpen), "inline-flex items-center gap-1")}
          >
            <Plus className="size-3" />
            {t("suggest.otherLocation")}
          </button>
        </div>
        {otherOpen && (
          <Field error={otherError}>
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <IconInput
                  icon={MapPin}
                  value={otherDraft}
                  maxLength={80}
                  autoFocus
                  onChange={(e) => {
                    setOtherDraft(e.target.value);
                    setOtherError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOther();
                    }
                  }}
                  placeholder={t("suggest.otherLocationPlaceholder")}
                  aria-label={t("suggest.otherLocation")}
                />
              </div>
              <Button type="button" variant="outline" onClick={addOther} disabled={!otherDraft.trim()}>
                {t("suggest.addLocation")}
              </Button>
            </div>
          </Field>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">{t("companies.facet.workModel")}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chips
            options={WORK_MODELS}
            value={workModels}
            onChange={setWorkModels}
            label={(w) => t(`companies.workModel.${w}`)}
          />
        </div>
      </div>

      <FormField
        id={`${id}-note`}
        label={t("submit.note")}
        hint={t("suggest.noteHint")}
        counter={`${note.length}/1000`}
      >
        <Textarea
          id={`${id}-note`}
          rows={3}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("suggest.notePlaceholder")}
        />
      </FormField>

      {/* Honeypot — hidden from humans, catches bots. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t("suggest.submit")}
      </Button>
    </form>
  );
}
