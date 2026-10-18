import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResourceDetail } from "@/components/resource-detail";
import { siteUrl, siteName } from "@/lib/site";
import { jsonLd } from "@/lib/json-ld";
import { OG_IMAGE } from "@/lib/og";
import { loadResource } from "./data";

/**
 * Nothing is prerendered at build: each page renders on its first visit and
 * is then served from the cache until its document changes. (Prerendered pages
 * weren't loaded into the deployed cache anyway, so the build only spent
 * Sanity requests.) Returning [] keeps the route cacheable.
 */
export async function generateStaticParams() {
  return [];
}

const load = loadResource;

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
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: resource.name, description, images: [OG_IMAGE.url] },
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
