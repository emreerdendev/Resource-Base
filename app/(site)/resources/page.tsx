import type { Metadata } from "next";
import { shareMeta } from "@/lib/og";
import { BrowseClient } from "@/components/browse-client";
import { HomeIntro } from "@/components/home-intro";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  allCategoriesQuery,
  allResourcesCompactQuery,
  allTagsQuery,
} from "@/sanity/lib/queries";
import type { Category, CompactResource, Tag } from "@/lib/types";

const DESCRIPTION =
  "A curated, searchable directory of the best resources for development, design and more.";

export const metadata: Metadata = {
  title: "Resources",
  description: DESCRIPTION,
  ...shareMeta("Resources", DESCRIPTION, "/resources"),
};

export default async function ResourcesPage() {
  const [resources, categories, tags] = await Promise.all([
    sanityFetch<CompactResource[]>({ query: allResourcesCompactQuery, tags: ["resource-list"] }),
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["taxonomy", "resource-list"] }),
    sanityFetch<Tag[]>({ query: allTagsQuery, tags: ["taxonomy", "resource-list"] }),
  ]);

  return (
    <BrowseClient
      resources={resources}
      categories={categories}
      tags={tags}
      basePath="/resources"
      intro={<HomeIntro count={resources.length} />}
    />
  );
}
