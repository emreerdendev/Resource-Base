import { NextResponse } from "next/server";
import type { SearchIndex } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { searchIndexQuery } from "@/sanity/lib/queries";

// Static: built once, kept in the page cache and refreshed by the same Sanity
// tags as the pages — one small cache entry instead of the dataset being
// serialized into every page's HTML.
export const dynamic = "force-static";

export async function GET() {
  const index = await sanityFetch<SearchIndex>({
    query: searchIndexQuery,
    tags: ["resource-list", "company-list"],
  });
  // Only the start of a description matters for search; keep the payload small.
  const resources = index.resources.map((r) => ({
    ...r,
    description: r.description?.slice(0, 240) || undefined,
  }));
  return NextResponse.json({ ...index, resources });
}
