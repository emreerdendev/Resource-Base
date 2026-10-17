import type { Metadata } from "next";
import { CompaniesClient } from "@/components/companies-client";
import { CompaniesIntro } from "@/components/companies-intro";
import type { Company } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCompaniesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "Companies",
  description:
    "A free, community-curated list of companies with their application emails, career pages and LinkedIn.",
  alternates: { canonical: "/companies" },
};

/**
 * Static: rendered once and served from the cache until a company changes
 * (the "company-list" tag). The random order is applied in the browser.
 */
export default async function CompaniesPage() {
  const companies = await sanityFetch<Company[]>({
    query: allCompaniesQuery,
    tags: ["company-list"],
  });

  return (
    <CompaniesClient companies={companies} intro={<CompaniesIntro count={companies.length} />} />
  );
}
