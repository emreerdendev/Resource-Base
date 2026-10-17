import { notFound, permanentRedirect } from "next/navigation";
import type { Category } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery } from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";

/**
 * Only `/category/<slug>` is a page. The catch-all exists for legacy nested
 * URLs (`/category/<parent>/<child>`), which redirect when the chain is real;
 * everything else 404s. Done here, above the loading boundary, so the 404 is
 * a real status — every distinct URL that rendered a page used to be cached
 * in KV, so arbitrary prefixes grew storage without bound.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string[] }>;
}) {
  const parts = (await params).slug;
  if (parts.length === 1 && (await hasSlug("category", parts[0]))) return children;
  if (parts.length === 2) {
    const all = await sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["category"] });
    if (all.some((c) => c.slug === parts[1] && c.parentSlug === parts[0]))
      permanentRedirect(`/category/${parts[1]}`);
  }
  notFound();
}
