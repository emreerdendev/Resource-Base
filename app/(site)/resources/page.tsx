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

export default async function HomePage() {
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
        basePath="/"
        intro={<HomeIntro count={resources.length} />}
      />
    </Suspense>
  );
}
