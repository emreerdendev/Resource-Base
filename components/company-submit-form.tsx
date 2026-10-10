"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, Building2, Globe, ListChecks, Loader2, Mail, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LinkedinIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { Textarea } from "@/components/ui/textarea";
import { CITIES, WORK_MODELS, type City, type WorkModel } from "@/lib/company-taxonomy";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

const URL_RE = /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
          >
            {label(o)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Suggest a company for the directory. Every suggestion is reviewed; on
 * approval the company goes live automatically and the submitter is notified.
 */
export function CompanySubmitForm({ initialName = "" }: { initialName?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useProfile();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState("");
  const [careerUrl, setCareerUrl] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [emails, setEmails] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [workModels, setWorkModels] = useState<WorkModel[]>([]);
  const [note, setNote] = useState("");

  const urlOk = (v: string) => !v.trim() || URL_RE.test(v.trim());
  const emailList = emails.split(/[,;\s]+/).filter(Boolean);
  const emailsOk = emailList.every((e) => EMAIL_RE.test(e));
  const hasWay = Boolean(website.trim() || careerUrl.trim() || linkedin.trim() || emailList.length);
  const valid =
    name.trim().length >= 2 &&
    hasWay &&
    urlOk(website) &&
    urlOk(careerUrl) &&
    urlOk(linkedin) &&
    emailsOk;

  function reset() {
    setName("");
    setWebsite("");
    setCareerUrl("");
    setLinkedin("");
    setEmails("");
    setCities([]);
    setWorkModels([]);
    setNote("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || pending) return;
    // Honeypot: bots fill hidden fields.
    if (new FormData(e.currentTarget).get("company")) return;

    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "company",
          name: name.trim(),
          website: website.trim(),
          careerUrl: careerUrl.trim(),
          linkedin: linkedin.trim(),
          emails: emailList.join(","),
          cities,
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
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("suggest.success"));
      reset();
    } catch {
      toast.error(t("submit.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("suggest.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("suggest.subtitle")}</p>
        {profile?.username && (
          <Button asChild variant="outline" size="sm" className="mt-3" type="button">
            <Link href={`/profile/${profile.username}`}>
              <ListChecks className="size-3.5" />
              {t("submit.viewMine")}
            </Link>
          </Button>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">{t("suggest.name")} *</label>
        <IconInput
          icon={Building2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          placeholder="e.g. Acme Teknoloji"
        />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("company.howToApply")} *</legend>
        <p className="-mt-1 text-xs text-muted-foreground">{t("suggest.waysHint")}</p>
        <IconInput
          icon={Mail}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder={t("suggest.emailsPlaceholder")}
          aria-invalid={!emailsOk}
          aria-label={t("suggest.emails")}
        />
        <IconInput
          icon={Briefcase}
          value={careerUrl}
          onChange={(e) => setCareerUrl(e.target.value)}
          placeholder={t("suggest.careerPlaceholder")}
          aria-invalid={!urlOk(careerUrl)}
          aria-label={t("suggest.career")}
        />
        <IconInput
          icon={LinkedinIcon}
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="https://www.linkedin.com/company/…"
          aria-invalid={!urlOk(linkedin)}
          aria-label="LinkedIn"
        />
        <IconInput
          icon={Globe}
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t("suggest.websitePlaceholder")}
          aria-invalid={!urlOk(website)}
          aria-label={t("suggest.website")}
        />
        <p className="text-[11px] text-muted-foreground">{t("suggest.privacyHint")}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("companies.facet.city")}</p>
          <Chips
            options={CITIES}
            value={cities}
            onChange={setCities}
            label={(c) => t(`companies.city.${c}`)}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("companies.facet.workModel")}</p>
          <Chips
            options={WORK_MODELS}
            value={workModels}
            onChange={setWorkModels}
            label={(w) => t(`companies.workModel.${w}`)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">{t("submit.note")}</label>
        <Textarea
          rows={3}
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("suggest.notePlaceholder")}
        />
      </div>

      {/* Honeypot — hidden from humans, catches bots. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <Button type="submit" disabled={!valid || pending} size="lg" className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t("suggest.submit")}
      </Button>
    </form>
  );
}
