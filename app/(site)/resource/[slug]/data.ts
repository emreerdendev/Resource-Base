import "server-only";

import { cache } from "react";
import type { ResourceWithRelated } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { resourceBySlugQuery } from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";

/**
 * The resource behind a slug, or null. Shared by the layout, the page and its
 * metadata (one fetch per render). Only this resource's tag: other edits
 * don't touch this page.
 */
export const loadResource = cache(async (slug: string) => {
  if (!(await hasSlug("resource", slug))) return null;
  return sanityFetch<ResourceWithRelated | null>({
    query: resourceBySlugQuery,
    params: { slug },
    tags: [`resource:${slug}`],
    revalidate: 86400,
  });
});
