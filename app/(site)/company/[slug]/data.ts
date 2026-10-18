import "server-only";

import { cache } from "react";
import type { CompanyWithRelated } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { companyBySlugQuery } from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";

/**
 * The company behind a slug, or null. Shared by the layout, the page and its
 * metadata (one fetch per render). Only this company's tag: other edits
 * don't touch this page.
 */
export const loadCompany = cache(async (slug: string) => {
  if (!(await hasSlug("company", slug))) return null;
  return sanityFetch<CompanyWithRelated | null>({
    query: companyBySlugQuery,
    params: { slug },
    tags: [`company:${slug}`],
    revalidate: 86400,
  });
});
