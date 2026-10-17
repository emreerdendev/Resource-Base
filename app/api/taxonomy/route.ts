import { NextResponse } from "next/server";
import type { Category, Tag } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery, allTagsQuery } from "@/sanity/lib/queries";

// Static, like /api/search-index: one cache entry refreshed by the taxonomy
// tag, loaded only where categories/tags are needed (the edit-suggestion UI),
// instead of being embedded in every page's HTML.
export const dynamic = "force-static";

export async function GET() {
  const [categories, tags] = await Promise.all([
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["taxonomy", "resource-list"] }),
    sanityFetch<Tag[]>({ query: allTagsQuery, tags: ["taxonomy", "resource-list"] }),
  ]);
  return NextResponse.json({ categories, tags });
}
