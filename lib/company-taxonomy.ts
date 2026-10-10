/**
 * Fixed vocabularies for the company directory. Shared by the Sanity schema
 * (option lists), the CSV import and the UI (filters + i18n keys), so a value
 * only ever has to be added in one place. Keep this file isomorphic — the
 * embedded Studio imports it too.
 */

/** How a company can be applied to. */
export const APPLICATION_CHANNELS = [
  "email",
  "career",
  "linkedin",
  "message",
  "hr",
] as const;
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number];

export const CITIES = ["istanbul", "ankara", "izmir"] as const;
export type City = (typeof CITIES)[number];

export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export type WorkModel = (typeof WORK_MODELS)[number];

export const SECTORS = [
  "gaming",
  "banking",
  "fintech",
  "ecommerce",
  "mobile",
  "ai",
  "cybersecurity",
  "defense",
  "consulting",
  "recruitment",
  "telecom",
  "health",
  "media",
  "saas",
] as const;
export type Sector = (typeof SECTORS)[number];

/** A user's personal application status for a tracked company. */
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return (
    typeof v === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(v)
  );
}

/** English labels for the Studio option lists (the site itself uses i18n). */
export const STUDIO_LABELS: Record<string, string> = {
  email: "Email",
  career: "Career page / ATS",
  linkedin: "LinkedIn",
  message: "Direct message",
  hr: "Reach HR / employees",
  istanbul: "İstanbul",
  ankara: "Ankara",
  izmir: "İzmir",
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  gaming: "Gaming",
  banking: "Banking",
  fintech: "Fintech",
  ecommerce: "E-commerce",
  mobile: "Mobile",
  ai: "AI",
  cybersecurity: "Cybersecurity",
  defense: "Defense",
  consulting: "Consulting / outsourcing",
  recruitment: "Recruitment / HR",
  telecom: "Telecom",
  health: "Health",
  media: "Media",
  saas: "SaaS",
};

export const studioOptions = (values: readonly string[]) =>
  values.map((value) => ({ title: STUDIO_LABELS[value] ?? value, value }));
