import { CategoryIcon } from "@/components/category-icon";
import { ResourceGrid } from "@/components/resource-grid";
import { T } from "@/components/t";
import { siteUrl } from "@/lib/site";
import type { Category, CategoryWithResources } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  allCategoriesQuery,
  categoryBySlugQuery,
} from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { NavLink as Link } from "@/components/nav-link";
import { notFound } from "next/navigation";
import { jsonLd } from "@/lib/json-ld";
import { shareMeta } from "@/lib/og";

/**
 * Nothing is prerendered at build: each page renders on its first visit and
 * is then served from the cache until its document changes. (Prerendered pages
 * weren't loaded into the deployed cache anyway, so the build only spent
 * Sanity requests.) Returning [] keeps the route cacheable.
 */
export async function generateStaticParams() {
  return [];
}

/**
 * Only `/category/<slug>` is a page; layout.tsx redirects legacy nested URLs
 * and 404s everything else before this runs. Re-checked here so the
 * per-slug fetch never runs for a made-up slug.
 */
async function load(slugParts: string[]) {
  const slug = slugParts[0];
  if (slugParts.length !== 1 || !(await hasSlug("category", slug)))
    return { slug, category: null };
  const category = await sanityFetch<CategoryWithResources | null>({
    query: categoryBySlugQuery,
    params: { slug },
    tags: ["taxonomy", "resource-list"],
  });
  return { slug, category };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug, category } = await load((await params).slug);
  if (!category) return {};
  const description = category.description ?? `Curated ${category.title.toLowerCase()} resources.`;
  return {
    title: category.title,
    description,
    ...shareMeta(category.title, description, `/category/${slug}`),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug, category } = await load((await params).slug);
  if (!category) notFound();

  const allCategories = await sanityFetch<Category[]>({
    query: allCategoriesQuery,
    tags: ["taxonomy"],
  });
  const meta = allCategories.find((c) => c.slug === slug);
  const parent = meta?.parentSlug
    ? allCategories.find((c) => c.slug === meta.parentSlug)
    : undefined;
  const children = allCategories.filter((c) => c.parentSlug === slug);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.title,
    url: `${siteUrl}/category/${slug}`,
    hasPart: category.resources.slice(0, 50).map((r) => ({
      "@type": "WebPage",
      name: r.name,
      url: r.url,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/resources" className="hover:text-foreground">
          <T k="category.home" />
        </Link>
        {parent && (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              href={`/category/${parent.slug}`}
              className="hover:text-foreground"
            >
              {parent.title}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{category.title}</span>
      </nav>

      <div className="mb-8 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-xl bg-primary/10 text-primary">
          <CategoryIcon name={category.icon} className="size-7" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {category.title}
          </h1>
          <p className="text-muted-foreground">
            <T k="category.resources" values={{ count: category.resources.length }} />
          </p>
        </div>
      </div>

      {children.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c._id}
              href={`/category/${c.slug}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40"
            >
              {c.title}
              <span className="ml-1.5 text-muted-foreground">{c.count}</span>
            </Link>
          ))}
        </div>
      )}

      <ResourceGrid resources={category.resources} />
    </div>
  );
}
