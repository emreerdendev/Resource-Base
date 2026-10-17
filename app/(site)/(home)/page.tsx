import { HomeOnboarding } from "@/components/home-onboarding";
import type { Category, Company, Resource } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  allCategoriesQuery,
  allCompaniesQuery,
  allResourcesQuery,
} from "@/sanity/lib/queries";

/**
 * Entry point: a short introduction to the two directories. Same tag-cached
 * queries as the site layout, so Next.js dedupes them within the request.
 */
export default async function HomePage() {
  const [companies, resources, categories] = await Promise.all([
    sanityFetch<Company[]>({ query: allCompaniesQuery, tags: ["company"] }),
    sanityFetch<Resource[]>({ query: allResourcesQuery, tags: ["resource"] }),
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["category"] }),
  ]);

  return (
    <HomeOnboarding
      companies={companies.length}
      resources={resources.length}
      categories={categories.filter((c) => !c.parentSlug).length}
    />
  );
}
