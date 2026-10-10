import { parseCsv } from "@/lib/csv";
import type { ApplicationStatus } from "@/lib/company-taxonomy";
import { slugify } from "@/lib/slug";
import type { Company } from "@/lib/types";

const NAME_HEADERS = ["şirket adı", "şirket", "firma", "company", "company name", "name", "organization"];
const STATUS_HEADERS = ["durum", "status", "stage", "aşama", "state"];

/** Free-text statuses (Turkish + English, as used in trackers) → ours. */
const STATUS_WORDS: [ApplicationStatus, string[]][] = [
  ["applied", ["başvuruldu", "basvuruldu", "başvurdum", "applied", "application sent", "sent"]],
  ["interview", ["mülakat", "mulakat", "görüşme", "gorusme", "interview", "interviewing"]],
  ["offer", ["teklif", "offer", "offered", "accepted", "kabul"]],
  ["rejected", ["ret", "red", "reddedildi", "olumsuz", "rejected", "declined", "rejection"]],
  ["saved", ["kaydedildi", "saved", "wishlist", "planned", "başvurulacak", "to apply"]],
];

export function mapStatus(raw: string): ApplicationStatus {
  const v = raw.trim().toLocaleLowerCase("tr");
  if (!v) return "saved";
  for (const [status, words] of STATUS_WORDS) if (words.includes(v)) return status;
  return "saved";
}

export type TrackerImportResult = {
  matched: { company: Company; status: ApplicationStatus }[];
  unmatched: string[];
};

/**
 * Read a tracker export (e.g. Notion "Şirket Adı" + "Durum" columns) and match
 * each row to a directory company by slug. Runs entirely in the browser.
 */
export function readTrackerCsv(
  text: string,
  companies: Company[],
): TrackerImportResult | { error: "no-name-column" | "empty" } {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!header || rows.length === 0) return { error: "empty" };
  const norm = header.map((h) => h.trim().toLocaleLowerCase("tr"));
  const nameCol = norm.findIndex((h) => NAME_HEADERS.includes(h));
  if (nameCol === -1) return { error: "no-name-column" };
  const statusCol = norm.findIndex((h) => STATUS_HEADERS.includes(h));

  const bySlug = new Map(companies.map((c) => [c.slug, c]));
  const matched = new Map<string, { company: Company; status: ApplicationStatus }>();
  const unmatched = new Set<string>();

  for (const row of rows) {
    const name = (row[nameCol] ?? "").trim();
    if (!name) continue;
    const company = bySlug.get(slugify(name));
    if (!company) {
      unmatched.add(name);
      continue;
    }
    const status = statusCol === -1 ? "saved" : mapStatus(row[statusCol] ?? "");
    const prev = matched.get(company._id);
    // Duplicate rows: a real status beats a bare "saved".
    if (!prev || prev.status === "saved") matched.set(company._id, { company, status });
  }

  return { matched: [...matched.values()], unmatched: [...unmatched] };
}
