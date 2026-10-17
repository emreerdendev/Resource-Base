import {
  normalizeEmail,
  normalizeLinkedinJobsUrl,
  normalizeWebUrl,
} from "@/lib/company-input";

/** The company fields an edit suggestion can change. */
export type CompanyEditFields = {
  name?: string;
  website?: string;
  careerUrl?: string;
  linkedin?: string;
  emails?: string[];
};

export const COMPANY_EDIT_KEYS = ["name", "website", "careerUrl", "linkedin", "emails"] as const;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Validate proposed company values (same rules as a new suggestion). An empty
 * string clears a link. Returns the normalized values, or which field is wrong.
 */
export function parseCompanyEdit(
  data: Record<string, unknown>,
): { ok: true; value: Required<Omit<CompanyEditFields, "emails">> & { emails: string[] } } | { ok: false; error: string } {
  const name = str(data.name).slice(0, 120);
  if (name.length < 2) return { ok: false, error: "name" };
  const link = (raw: unknown, fn: (v: string) => string | null) => {
    const v = str(raw);
    return v ? fn(v) : "";
  };
  const website = link(data.website, normalizeWebUrl);
  const careerUrl = link(data.careerUrl, normalizeWebUrl);
  const linkedin = link(data.linkedin, normalizeLinkedinJobsUrl);
  if (website === null) return { ok: false, error: "website" };
  if (careerUrl === null) return { ok: false, error: "careerUrl" };
  if (linkedin === null) return { ok: false, error: "linkedin" };
  const rawEmails = (Array.isArray(data.emails) ? data.emails : str(data.emails).split(/[,;\s]+/))
    .map((e) => str(e))
    .filter(Boolean);
  const emails = Array.from(new Set(rawEmails.map(normalizeEmail)));
  if (emails.some((e) => e === null) || emails.length > 5) return { ok: false, error: "emails" };
  return { ok: true, value: { name, website, careerUrl, linkedin, emails: emails as string[] } };
}

/** Only the fields that differ from the current values. */
export function changedFields(
  current: Required<CompanyEditFields>,
  proposed: Required<CompanyEditFields>,
): CompanyEditFields {
  const out: CompanyEditFields = {};
  for (const k of COMPANY_EDIT_KEYS) {
    if (k === "emails") {
      const a = [...current.emails].sort().join(",");
      const b = [...proposed.emails].sort().join(",");
      if (a !== b) out.emails = proposed.emails;
    } else if ((current[k] ?? "") !== (proposed[k] ?? "")) {
      out[k] = proposed[k];
    }
  }
  return out;
}
