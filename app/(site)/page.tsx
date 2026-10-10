import { Suspense } from "react";
import { connection } from "next/server";
import { CompaniesClient } from "@/components/companies-client";
import { CompaniesIntro } from "@/components/companies-intro";
import { shuffle } from "@/lib/company-utils";
import type { Company } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCompaniesQuery } from "@/sanity/lib/queries";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Old resource-browser links (/?category=…) are redirected in next.config.
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
      {/* Keyed by sector so in-app sector links (/?sector=…) start fresh. */}
      <CompaniesClient
        key={typeof params.sector === "string" ? params.sector : ""}
        companies={shuffle(companies)}
        intro={<CompaniesIntro count={companies.length} />}
      />
    </Suspense>
  );
}
