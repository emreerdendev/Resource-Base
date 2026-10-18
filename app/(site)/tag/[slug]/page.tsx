import { ResourceGrid } from "@/components/resource-grid";
import { T } from "@/components/t";
import { shareMeta } from "@/lib/og";
import type { TagWithResources } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { tagBySlugQuery } from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";
import { ChevronRight, Hash } from "lucide-react";
import type { Metadata } from "next";
import { NavLink as Link } from "@/components/nav-link";
import { notFound } from "next/navigation";

/**
 * Nothing is prerendered at build: each page renders on its first visit and
 * is then served from the cache until its document changes. (Prerendered pages
 * weren't loaded into the deployed cache anyway, so the build only spent
 * Sanity requests.) Returning [] keeps the route cacheable.
 */
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  if (!(await hasSlug("tag", slug))) return null;
  return sanityFetch<TagWithResources | null>({
    query: tagBySlugQuery,
    params: { slug },
    tags: ["taxonomy", "resource-list"],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await load(slug);
  if (!tag) return {};
  const title = `${tag.title} resources`;
  const description = `Resources tagged ${tag.title}.`;
  return { title, description, ...shareMeta(title, description, `/tag/${slug}`) };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tag = await load((await params).slug);
  if (!tag) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/resources" className="hover:text-foreground">
          <T k="tag.home" />
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">#{tag.title}</span>
      </nav>

      <div className="mb-8 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-xl bg-primary/10 text-primary">
          <Hash className="size-7" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tag.title}</h1>
          <p className="text-muted-foreground">
            <T k="tag.resources" values={{ count: tag.resources.length }} />
          </p>
        </div>
      </div>

      <ResourceGrid resources={tag.resources} />
    </div>
  );
}
