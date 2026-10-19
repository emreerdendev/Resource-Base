"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Building2, Globe, Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LinkedinIcon } from "@/components/brand-icons";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Textarea } from "@/components/ui/textarea";
import { changedFields, type CompanyEditFields } from "@/lib/company-edit";
import { normalizeEmail, normalizeLinkedinJobsUrl, normalizeWebUrl } from "@/lib/company-input";
import type { Company } from "@/lib/types";
import { fieldProps } from "@/lib/use-form-errors";
import { cn } from "@/lib/utils";

const splitEmails = (v: string) => v.split(/[,;\s]+/).filter(Boolean);

/**
 * Inline editor for suggesting corrections to a company — its name, website,
 * career page, LinkedIn and application emails — or reporting it as gone.
 * Starts from the live values; an emptied field asks for that link to be
 * removed. Only changed fields are sent; an editor reviews the suggestion.
 */
export function CompanyEditEditor({
  company,
  onCancel,
  onDone,
  resubmit,
}: {
  company: Company;
  onCancel: () => void;
  onDone: () => void;
  /** Start from a rejected suggestion, replacing it when sent. */
  resubmit?: { replaces: string; proposed: CompanyEditFields | null; removal: boolean; note: string | null };
}) {
  const { t } = useTranslation();
  const id = useId();
  const original = {
    name: company.name,
    website: company.website ?? "",
    careerUrl: company.careerLinks[0] ?? "",
    linkedin: company.linkedin ?? "",
    emails: company.emails,
  };
  // A resubmission starts from what was proposed; untouched fields from now.
  const start = { ...original, ...(resubmit?.proposed ?? {}) };
  const [name, setName] = useState(start.name);
  const [website, setWebsite] = useState(start.website);
  const [careerUrl, setCareerUrl] = useState(start.careerUrl);
  const [linkedin, setLinkedin] = useState(start.linkedin);
  const [emails, setEmails] = useState((start.emails ?? []).join(", "));
  const [note, setNote] = useState(resubmit?.note ?? "");
  // "Gone / should be removed" replaces every other change.
  const [removal, setRemoval] = useState(resubmit?.removal ?? false);
  const [pending, setPending] = useState(false);

  const link = (v: string, fn: (v: string) => string | null) => (v.trim() ? fn(v) : "");
  const proposed = {
    name: name.trim(),
    website: link(website, normalizeWebUrl),
    careerUrl: link(careerUrl, normalizeWebUrl),
    linkedin: link(linkedin, normalizeLinkedinJobsUrl),
    emails: splitEmails(emails).map((e) => normalizeEmail(e)),
  };
  const errors = removal
    ? {}
    : {
        name: proposed.name.length < 2 ? t("validation.tooShort", { min: 2 }) : null,
        website: proposed.website === null ? t("suggest.invalidUrl") : null,
        careerUrl: proposed.careerUrl === null ? t("suggest.invalidUrl") : null,
        linkedin: proposed.linkedin === null ? t("suggest.invalidLinkedin") : null,
        emails:
          proposed.emails.some((e) => !e) || proposed.emails.length > 5 ? t("suggest.invalidEmail") : null,
      };
  const invalid = Object.values(errors).some(Boolean);
  const changes = invalid
    ? {}
    : changedFields(original, {
        ...proposed,
        website: proposed.website ?? "",
        careerUrl: proposed.careerUrl ?? "",
        linkedin: proposed.linkedin ?? "",
        emails: Array.from(new Set(proposed.emails as string[])),
      });
  // A note alone is enough: e.g. the company pointing out a mistake.
  const dirty = removal || Object.keys(changes).length > 0 || note.trim().length > 0;

  /** Replace a field's value with its normalized form when it's valid. */
  const tidy = (v: string, set: (v: string) => void, fn: (v: string) => string | null) => {
    const n = v.trim() ? fn(v) : null;
    if (n) set(n);
  };

  async function submit() {
    if (!dirty || invalid || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "companyEdit",
          targetCompanyId: company._id,
          ...(resubmit && { replaces: resubmit.replaces }),
          note: note.trim(),
          ...(removal
            ? { proposeRemoval: true }
            : {
                name: proposed.name,
                website: proposed.website,
                careerUrl: proposed.careerUrl,
                linkedin: proposed.linkedin,
                emails: proposed.emails.join(","),
              }),
        }),
      });
      if (res.status === 409) {
        toast.info(t("companyEdit.alreadyPending"));
        onDone();
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
      toast.success(t("taxonomy.success"));
      onDone();
    } catch {
      toast.error(t("taxonomy.error"));
    } finally {
      setPending(false);
    }
  }

  const err = (k: keyof typeof errors) => (errors as Record<string, string | null>)[k] ?? null;

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
          <span className="font-medium">{t("companyEdit.removal")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{t("taxonomy.removalHint")}</span>
        </span>
      </label>

      {/* Every other field is locked while the company is reported as gone. */}
      <fieldset disabled={removal} className={cn("flex flex-col gap-3", removal && "opacity-50")}>
        <FormField id={`${id}-name`} label={t("suggest.name")} error={err("name")}>
          <IconInput
            {...fieldProps(`${id}-name`, err("name"))}
            icon={Building2}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("company.howToApply")}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("companyEdit.clearHint")}</p>
        </div>
        <FormField id={`${id}-emails`} label={t("suggest.emails")} error={err("emails")}>
          <IconInput
            {...fieldProps(`${id}-emails`, err("emails"))}
            icon={Mail}
            inputMode="email"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            onBlur={() => {
              if (!err("emails")) setEmails(proposed.emails.join(", "));
            }}
            placeholder={t("suggest.emailsPlaceholder")}
          />
        </FormField>
        <FormField id={`${id}-career`} label={t("suggest.career")} error={err("careerUrl")}>
          <IconInput
            {...fieldProps(`${id}-career`, err("careerUrl"))}
            icon={Briefcase}
            inputMode="url"
            value={careerUrl}
            onChange={(e) => setCareerUrl(e.target.value)}
            onBlur={() => tidy(careerUrl, setCareerUrl, normalizeWebUrl)}
            placeholder={t("suggest.careerPlaceholder")}
          />
        </FormField>
        <FormField id={`${id}-linkedin`} label="LinkedIn" error={err("linkedin")}>
          <IconInput
            {...fieldProps(`${id}-linkedin`, err("linkedin"))}
            icon={LinkedinIcon}
            inputMode="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            onBlur={() => tidy(linkedin, setLinkedin, normalizeLinkedinJobsUrl)}
            placeholder="https://www.linkedin.com/company/…"
          />
        </FormField>
        <FormField id={`${id}-website`} label={t("suggest.website")} error={err("website")}>
          <IconInput
            {...fieldProps(`${id}-website`, err("website"))}
            icon={Globe}
            inputMode="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onBlur={() => tidy(website, setWebsite, normalizeWebUrl)}
            placeholder={t("suggest.websitePlaceholder")}
          />
        </FormField>
        <p className="text-[11px] text-muted-foreground">{t("suggest.privacyHint")}</p>
      </fieldset>

      <FormField
        id={`${id}-note`}
        label={removal ? t("taxonomy.removalReason") : t("companyEdit.note")}
        counter={`${note.length}/1000`}
      >
        <Textarea
          id={`${id}-note`}
          rows={2}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={removal ? t("companyEdit.removalPlaceholder") : t("companyEdit.notePlaceholder")}
        />
      </FormField>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          {t("submissions.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={pending || !dirty || invalid}
          onClick={submit}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("taxonomy.submit")}
        </Button>
      </div>
    </div>
  );
}
