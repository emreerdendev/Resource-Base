import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CompaniesClient } from "@/components/companies-client";
import { CompaniesIntro } from "@/components/companies-intro";
import { shuffle } from "@/lib/company-utils";
import type { Company } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCompaniesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "Companies",
  description:
    "A free, community-curated list of companies with their application emails, career pages and LinkedIn.",
  alternates: { canonical: "/companies" },
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Render per request so every visit gets a fresh random order. The Sanity
  // read itself stays tag-cached, so this is a cheap in-memory shuffle.
  await connection();
  const companies = await sanityFetch<Company[]>({
    query: allCompaniesQuery,
    tags: ["company"],
  });

  return (
    <Suspense>
      {/* Keyed by sector so in-app sector links (?sector=…) start fresh. */}
      <CompaniesClient
        key={typeof params.sector === "string" ? params.sector : ""}
        companies={shuffle(companies)}
        intro={<CompaniesIntro count={companies.length} />}
      />
    </Suspense>
  );
}
