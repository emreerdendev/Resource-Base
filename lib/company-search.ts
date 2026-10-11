import { createSearch } from "@/lib/search";
import type { Company } from "@/lib/types";

const host = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/**
 * Company search (directory + ⌘K): name first, then the company's own domain
 * and email domains, then clients and locations. See createSearch.
 */
export function createCompanySearch<
  T extends Pick<Company, "name" | "website" | "emails" | "clients" | "otherLocations">,
>(companies: T[]) {
  return createSearch(companies, (c) => c.name, [
    { get: (c) => [host(c.website), ...c.emails.map((e) => e.split("@")[1] ?? "")] },
    { get: (c) => [...c.clients, ...c.otherLocations] },
  ]);
}
