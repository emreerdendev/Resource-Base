import type { MetadataRoute } from "next";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  categorySlugsQuery,
  companySlugsQuery,
  resourceSlugsQuery,
  tagSlugsQuery,
} from "@/sanity/lib/queries";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, tags, resources, companies] = await Promise.all([
    sanityFetch<string[]>({ query: categorySlugsQuery, tags: ["category"] }),
    sanityFetch<string[]>({ query: tagSlugsQuery, tags: ["tag"] }),
    sanityFetch<string[]>({ query: resourceSlugsQuery, tags: ["resource"] }),
    sanityFetch<string[]>({ query: companySlugsQuery, tags: ["company"] }),
  ]);

  const staticPaths = ["", "/companies", "/resources", "/categories", "/submit", "/privacy", "/terms"];

  return [
    ...staticPaths.map((p) => ({
      url: `${siteUrl}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : p === "/companies" || p === "/resources" ? 0.9 : 0.5,
    })),
    ...companies.map((slug) => ({
      url: `${siteUrl}/company/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...resources.map((slug) => ({
      url: `${siteUrl}/resource/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...categories.map((slug) => ({
      url: `${siteUrl}/category/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...tags.map((slug) => ({
      url: `${siteUrl}/tag/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
