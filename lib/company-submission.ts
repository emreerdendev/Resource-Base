import {
  MAX_OTHER_LOCATIONS,
  normalizeEmail,
  normalizeLinkedinJobsUrl,
  normalizeLocation,
  normalizeWebUrl,
} from "@/lib/company-input";
import { CITIES, WORK_MODELS, type City, type WorkModel } from "@/lib/company-taxonomy";

/** A community-suggested company, validated and normalized server-side. */
export type CompanySuggestion = {
  name: string;
  website?: string;
  careerUrl?: string;
  /** Always the company's LinkedIn jobs tab (…/company/<slug>/jobs/). */
  linkedin?: string;
  emails: string[];
  cities: City[];
  /** Free-text places outside the quick-pick cities ("Berlin, Germany"). */
  otherLocations: string[];
  workModels: WorkModel[];
  note: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const pick = <T extends string>(raw: unknown, allowed: readonly T[]): T[] =>
  Array.from(
    new Set((Array.isArray(raw) ? raw : []).filter((v): v is T => allowed.includes(v as T))),
  );

/**
 * Validate a company suggestion body. Needs a name plus at least one way to
 * apply (website, career page, LinkedIn or an email) — a bare name helps no one.
 */
export function parseCompanySuggestion(
  data: Record<string, unknown>,
): { ok: true; value: CompanySuggestion } | { ok: false; error: string } {
  const name = str(data.name).slice(0, 120);
  if (name.length < 2) return { ok: false, error: "A company name is required" };

  const url = (raw: string, normalize: (v: string) => string | null) =>
    raw ? (normalize(raw) ?? null) : undefined;
  const website = url(str(data.website), normalizeWebUrl);
  const careerUrl = url(str(data.careerUrl), normalizeWebUrl);
  const linkedin = url(str(data.linkedin), normalizeLinkedinJobsUrl);
  if (website === null || careerUrl === null) return { ok: false, error: "Invalid URL" };
  if (linkedin === null)
    return { ok: false, error: "LinkedIn must be a company page (linkedin.com/company/…)" };

  const rawEmails = String(data.emails ?? "")
    .split(/[,;\s]+/)
    .filter(Boolean);
  const emails = Array.from(new Set(rawEmails.map(normalizeEmail)));
  if (emails.some((e) => e === null)) return { ok: false, error: "Invalid email" };
  if (emails.length > 5) return { ok: false, error: "Too many emails" };

  if (!website && !careerUrl && !linkedin && !emails.length)
    return { ok: false, error: "Add at least one way to apply" };

  const cities = new Set(pick(data.cities, CITIES));
  const otherLocations = new Set<string>();
  const rawOthers = Array.isArray(data.otherLocations) ? data.otherLocations : [];
  if (rawOthers.length > MAX_OTHER_LOCATIONS) return { ok: false, error: "Too many locations" };
  for (const raw of rawOthers) {
    const loc = normalizeLocation(String(raw));
    if (!loc) return { ok: false, error: "Invalid location" };
    if ("city" in loc) cities.add(loc.city);
    else otherLocations.add(loc.other);
  }

  return {
    ok: true,
    value: {
      name,
      website,
      careerUrl,
      linkedin,
      emails: emails as string[],
      cities: [...cities],
      otherLocations: [...otherLocations],
      workModels: pick(data.workModels, WORK_MODELS),
      note: str(data.note).slice(0, 1000),
    },
  };
}
