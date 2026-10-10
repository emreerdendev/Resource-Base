import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseClient } from "@/components/browse-client";
import { HomeIntro } from "@/components/home-intro";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  allCategoriesQuery,
  allResourcesQuery,
  allTagsQuery,
} from "@/sanity/lib/queries";
import type { Category, Resource, Tag } from "@/lib/types";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "A curated, searchable directory of the best resources for development, design and more.",
  alternates: { canonical: "/resources" },
};

export default async function ResourcesPage() {
  const [resources, categories, tags] = await Promise.all([
    sanityFetch<Resource[]>({ query: allResourcesQuery, tags: ["resource"] }),
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["category"] }),
    sanityFetch<Tag[]>({ query: allTagsQuery, tags: ["tag"] }),
  ]);

  return (
    <Suspense>
      <BrowseClient
        resources={resources}
        categories={categories}
        tags={tags}
        basePath="/resources"
        intro={<HomeIntro count={resources.length} />}
      />
    </Suspense>
  );
}
