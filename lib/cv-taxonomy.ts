/**
 * Fixed vocabularies for the CV directory, shared by the upload validation,
 * the Sanity review form and the UI filters (i18n keys `cvs.field.*`, …).
 * Keep isomorphic — the embedded Studio imports it too.
 */

/** The role area a CV is for. */
export const CV_FIELDS = [
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "data",
  "devops",
  "qa",
  "security",
  "game",
  "embedded",
  "design",
  "product",
  "marketing",
  "other",
] as const;
export type CvField = (typeof CV_FIELDS)[number];

export const CV_SENIORITIES = ["intern", "junior", "mid", "senior", "lead"] as const;
export type CvSeniority = (typeof CV_SENIORITIES)[number];

/** The language the CV is written in. */
export const CV_LANGUAGES = ["tr", "en", "other"] as const;
export type CvLanguage = (typeof CV_LANGUAGES)[number];

/** pending → reviewed in Sanity → published or rejected; hidden = owner unlisted it. */
export const CV_STATUSES = ["pending", "published", "rejected", "hidden"] as const;
export type CvStatus = (typeof CV_STATUSES)[number];

/** Upload limits. */
export const CV_MAX_BYTES = 2 * 1024 * 1024;
export const CV_MAX_TECHNOLOGIES = 10;
export const CV_TITLE_MAX = 80;
export const CV_SUMMARY_MAX = 300;

/** Suggestions for the technology input; any short tag is accepted. */
export const CV_TECH_SUGGESTIONS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Node.js",
  "Python", "Java", "Kotlin", "Swift", "Flutter", "React Native", "C#", ".NET",
  "Go", "Rust", "PHP", "Laravel", "Spring", "Django", "SQL", "PostgreSQL",
  "MongoDB", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Figma", "Unity",
  "Machine Learning", "Tailwind CSS", "GraphQL", "Git",
];

export const CV_STUDIO_LABELS: Record<string, string> = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Full-stack",
  mobile: "Mobile",
  data: "Data & AI",
  devops: "DevOps & Cloud",
  qa: "QA & Testing",
  security: "Security",
  game: "Game development",
  embedded: "Embedded & Hardware",
  design: "UI/UX Design",
  product: "Product & Project",
  marketing: "Marketing & Growth",
  other: "Other",
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / Principal",
  tr: "Turkish",
  en: "English",
};

export const cvStudioOptions = (values: readonly string[]) =>
  values.map((value) => ({ title: CV_STUDIO_LABELS[value] ?? value, value }));

export const isCvField = (v: unknown): v is CvField => CV_FIELDS.includes(v as CvField);
export const isCvSeniority = (v: unknown): v is CvSeniority =>
  CV_SENIORITIES.includes(v as CvSeniority);
export const isCvLanguage = (v: unknown): v is CvLanguage => CV_LANGUAGES.includes(v as CvLanguage);
