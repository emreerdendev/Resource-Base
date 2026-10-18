import type { Metadata } from "next";
import { HomeOnboarding } from "@/components/home-onboarding";
import { shareMeta } from "@/lib/og";
import { siteDescription } from "@/lib/site";
import { sanityFetch } from "@/sanity/lib/fetch";
import { homeCountsQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = shareMeta(
  "Resource Base — Resources, Companies & CVs",
  siteDescription,
  "/",
);

/** Entry point: a short introduction to the directories, with their sizes. */
export default async function HomePage() {
  const counts = await sanityFetch<{ resources: number; companies: number; categories: number }>({
    query: homeCountsQuery,
    tags: ["resource-list", "company-list", "taxonomy"],
  });

  return (
    <HomeOnboarding
      companies={counts.companies}
      resources={counts.resources}
      categories={counts.categories}
    />
  );
}
