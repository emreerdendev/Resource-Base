"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Copy,
  Handshake,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LinkedinIcon } from "@/components/brand-icons";
import { useAuth } from "@/components/auth/auth-provider";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { useContributors } from "@/components/contributors-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { normalizeLinkedinJobsUrl } from "@/lib/company-input";
import { hasContact, hostLabel, searchLinks } from "@/lib/company-utils";
import type { Company } from "@/lib/types";
import { profilePath } from "@/lib/username";

/** Pill shared with the resource modal — accent background, rounded, hover. */
export const PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent/70";

const ROW =
  "group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function EmailRow({ email }: { email: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success(t("company.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the mailto link still works */
    }
  }
  return (
    <div className={ROW}>
      <Mail className="size-4 shrink-0 text-primary" />
      <a href={`mailto:${email}`} className="min-w-0 flex-1 truncate hover:underline">
        {email}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={t("company.copyEmail")}
        title={t("company.copyEmail")}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ROW}>
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </a>
  );
}

/**
 * Private, per-user note on a company — saved to the user's tracker (writing
 * one also saves the company to My Applications). Only saved with the button.
 */
function NoteEditor({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { get, setNote } = useCompanyTracker();
  const saved = get(companyId)?.note ?? "";
  const [value, setValue] = useState(saved);
  const [pending, setPending] = useState(false);
  // Follow the stored note when it changes elsewhere (adjust state in render).
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setValue(saved);
  }
  const dirty = value.trim() !== saved.trim();

  async function save() {
    if (!dirty || pending) return;
    setPending(true);
    const ok = await setNote(companyId, value);
    setPending(false);
    if (ok) toast.success(t("tracker.noteSaved"));
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <NotebookPen className="size-3.5" /> {t("tracker.note")}
        </span>
      </SectionLabel>
      <Textarea
        value={value}
        maxLength={1000}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("tracker.notePlaceholder")}
        aria-label={t("tracker.note")}
        className="min-h-20 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {pending ? t("tracker.noteSaving") : !dirty && saved ? t("tracker.noteSavedHint") : t("tracker.notePrivate")}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => void save()}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : !dirty && saved ? <Check className="size-3.5" /> : null}
          {!dirty && saved ? t("tracker.noteSavedShort") : t("tracker.saveNote")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Everything we know about a company, focused on *how to apply*. Shared by the
 * detail modal and the /company/[slug] page so both stay identical.
 */
export function CompanyDetails({
  company,
  onNavigate,
}: {
  company: Company;
  /** Called when an in-app link is followed (e.g. to close a modal). */
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const contact = hasContact(company);
  const search = searchLinks(company.name);
  const places = [
    ...company.cities.map((c) => t(`companies.city.${c}`)),
    ...company.otherLocations,
    ...company.workModels.map((w) => t(`companies.workModel.${w}`)),
  ];

  return (
    <div className="flex flex-col gap-5">
      {company.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{company.description}</p>
      )}

      {/* How to apply */}
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("company.howToApply")}</SectionLabel>
        {contact ? (
          <div className="grid gap-2">
            {company.emails.map((email) => (
              <EmailRow key={email} email={email} />
            ))}
            {company.careerLinks.map((url) => (
              <LinkRow key={url} href={url} icon={<Briefcase className="size-4" />} label={hostLabel(url)} />
            ))}
            {company.linkedin && (
              <LinkRow
                href={normalizeLinkedinJobsUrl(company.linkedin) ?? company.linkedin}
                icon={<LinkedinIcon className="size-4" />}
                label={t("company.linkedin")}
              />
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p>{t("company.noContact")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={search.linkedin} target="_blank" rel="noopener noreferrer" className={PILL}>
                <LinkedinIcon className="size-3.5" /> {t("company.searchLinkedin")}
              </a>
              <a href={search.web} target="_blank" rel="noopener noreferrer" className={PILL}>
                <Search className="size-3.5" /> {t("company.searchWeb")}
              </a>
            </div>
          </div>
        )}

        {/* Tip gathered from how people actually got responses. */}
        {company.channels.includes("message") && (
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <MessageCircle className="mt-px size-3.5 shrink-0 text-primary" />
            {t("company.tipMessage")}
          </p>
        )}
      </div>

      {places.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t("company.location")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <span key={p} className={PILL}>
                <MapPin className="size-3.5" /> {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {company.sectors.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t("company.sectors")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {company.sectors.map((s) => (
              <Link key={s} href={`/companies?sector=${s}`} onClick={onNavigate} className={PILL}>
                {t(`companies.sector.${s}`)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {company.clients.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>{t("company.clients")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {company.clients.map((c) => (
              <span key={c} className={PILL}>
                <Handshake className="size-3.5" /> {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {user ? (
        <NoteEditor companyId={company._id} />
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          {t("tracker.signInHint")}
        </p>
      )}
    </div>
  );
}

/** "Added by @username" for community-suggested companies, resolved live by user id. */
export function AddedByLink({ userId, onNavigate }: { userId: string; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { register, get } = useContributors();
  useEffect(() => register(userId), [register, userId]);
  const who = get(userId);
  if (!who?.username) return null;
  return (
    <Link
      href={profilePath(who.username)}
      onClick={onNavigate}
      className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {who.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={who.avatar_url} alt="" referrerPolicy="no-referrer" className="size-4 rounded-full object-cover" />
      ) : null}
      {t("card.addedBy", { username: who.username })}
    </Link>
  );
}
