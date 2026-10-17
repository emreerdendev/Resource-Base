import {
  CV_MAX_TECHNOLOGIES,
  CV_SUMMARY_MAX,
  CV_TITLE_MAX,
  isCvField,
  isCvLanguage,
  isCvSeniority,
  type CvField,
  type CvLanguage,
  type CvSeniority,
} from "@/lib/cv-taxonomy";

export type CvMeta = {
  title: string;
  field: CvField;
  seniority: CvSeniority;
  language: CvLanguage;
  technologies: string[];
  summary: string | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** "react, Next.js ,react" → ["react", "Next.js"]: trimmed, deduped (case-insensitive), capped. */
export function parseTechnologies(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map(str) : str(raw).split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list.map((x) => x.trim().replace(/\s+/g, " ")).filter(Boolean)) {
    if (t.length > 30 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, CV_MAX_TECHNOLOGIES);
}

/** Validate the listing details sent with an upload. Shared by the form and the API. */
export function parseCvMeta(
  data: Record<string, unknown>,
): { ok: true; value: CvMeta } | { ok: false; error: string } {
  const title = str(data.title).replace(/\s+/g, " ");
  if (title.length < 2 || title.length > CV_TITLE_MAX) return { ok: false, error: "title" };
  if (!isCvField(data.field)) return { ok: false, error: "field" };
  if (!isCvSeniority(data.seniority)) return { ok: false, error: "seniority" };
  if (!isCvLanguage(data.language)) return { ok: false, error: "language" };
  const summary = str(data.summary);
  if (summary.length > CV_SUMMARY_MAX) return { ok: false, error: "summary" };
  return {
    ok: true,
    value: {
      title,
      field: data.field,
      seniority: data.seniority,
      language: data.language,
      technologies: parseTechnologies(data.technologies),
      summary: summary || null,
    },
  };
}
