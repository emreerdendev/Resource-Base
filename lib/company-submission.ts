import { CITIES, WORK_MODELS, type City, type WorkModel } from "@/lib/company-taxonomy";

/** A community-suggested company, validated and normalized server-side. */
export type CompanySuggestion = {
  name: string;
  website?: string;
  careerUrl?: string;
  linkedin?: string;
  emails: string[];
  cities: City[];
  workModels: WorkModel[];
  note: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanUrl(raw: unknown): string | undefined | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null; // present but malformed
  }
}

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
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 120) : "";
  if (name.length < 2) return { ok: false, error: "A company name is required" };

  const website = cleanUrl(data.website);
  const careerUrl = cleanUrl(data.careerUrl);
  const linkedin = cleanUrl(data.linkedin);
  if (website === null || careerUrl === null || linkedin === null)
    return { ok: false, error: "Invalid URL" };
  if (linkedin && !/(^|\.)linkedin\.com$/i.test(new URL(linkedin).hostname))
    return { ok: false, error: "LinkedIn URL must be on linkedin.com" };

  const emails = Array.from(
    new Set(
      String(data.emails ?? "")
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (emails.some((e) => !EMAIL_RE.test(e) || e.length > 200))
    return { ok: false, error: "Invalid email" };
  if (emails.length > 5) return { ok: false, error: "Too many emails" };

  if (!website && !careerUrl && !linkedin && !emails.length)
    return { ok: false, error: "Add at least one way to apply" };

  return {
    ok: true,
    value: {
      name,
      website,
      careerUrl,
      linkedin,
      emails,
      cities: pick(data.cities, CITIES),
      workModels: pick(data.workModels, WORK_MODELS),
      note: typeof data.note === "string" ? data.note.trim().slice(0, 1000) : "",
    },
  };
}
