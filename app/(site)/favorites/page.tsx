import type { Metadata } from "next";
import { FavoritesClient } from "@/components/favorites-client";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery, allResourcesCompactQuery, allTagsQuery } from "@/sanity/lib/queries";
import type { Category, CompactResource, Tag } from "@/lib/types";

export const metadata: Metadata = {
  title: "Favorite Resources",
  description: "Resources you've saved.",
  robots: { index: false, follow: false },
};

// Auth is enforced in middleware (PROTECTED_PAGES → redirects signed-out
// visitors home before render), so the page skips a redundant getUser()
// round-trip. FavoritesClient still renders a sign-in prompt as a UX fallback.
export default async function FavoritesPage() {
  // Compact (see CompactResource); only the favorited ones are expanded.
  const [resources, categories, tags] = await Promise.all([
    sanityFetch<CompactResource[]>({ query: allResourcesCompactQuery, tags: ["resource-list"] }),
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["taxonomy", "resource-list"] }),
    sanityFetch<Tag[]>({ query: allTagsQuery, tags: ["taxonomy", "resource-list"] }),
  ]);
  return <FavoritesClient resources={resources} categories={categories} tags={tags} />;
}
