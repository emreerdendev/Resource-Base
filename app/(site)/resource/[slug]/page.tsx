import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResourceDetail } from "@/components/resource-detail";
import { sanityFetch } from "@/sanity/lib/fetch";
import { resourceBySlugQuery } from "@/sanity/lib/queries";
import { hasSlug, listSlugs } from "@/sanity/lib/slugs";
import type { ResourceWithRelated } from "@/lib/types";
import { siteUrl, siteName } from "@/lib/site";
import { jsonLd } from "@/lib/json-ld";

export async function generateStaticParams() {
  const slugs = await listSlugs("resource");
  return slugs.map((slug) => ({ slug }));
}

async function load(slug: string) {
  if (!(await hasSlug("resource", slug))) return null;
  return sanityFetch<ResourceWithRelated | null>({
    query: resourceBySlugQuery,
    params: { slug },
    tags: ["resource"],
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = await load(slug);
  if (!resource) return {};
  const description =
    resource.description ??
    `${resource.name} — a curated resource on ${siteName}.`;
  const url = `${siteUrl}/resource/${slug}`;
  return {
    title: resource.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: resource.name,
      description,
      url,
    },
    twitter: { card: "summary_large_image", title: resource.name, description },
  };
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = await load(slug);
  if (!resource) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: resource.name,
    description: resource.description ?? undefined,
    url: `${siteUrl}/resource/${slug}`,
    mainEntity: { "@type": "WebSite", name: resource.name, url: resource.url },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <ResourceDetail resource={resource} />
    </>
  );
}
