import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyPageView } from "@/components/company-page";
import { rankRelatedCompanies } from "@/lib/company-utils";
import { siteName, siteUrl } from "@/lib/site";
import type { CompanyWithRelated } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { companyBySlugQuery } from "@/sanity/lib/queries";
import { hasSlug } from "@/sanity/lib/slugs";
import { jsonLd } from "@/lib/json-ld";

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
  if (!(await hasSlug("company", slug))) return null;
  const company = await sanityFetch<CompanyWithRelated | null>({
    query: companyBySlugQuery,
    params: { slug },
    // Only this company's tag: other edits don't touch this page.
    tags: [`company:${slug}`],
    revalidate: 86400,
  });
  return company && { ...company, related: rankRelatedCompanies(slug, company.related) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await load(slug);
  if (!company) return {};
  const title = `${company.name} — careers & how to apply`;
  const description =
    company.description ??
    `How to apply to ${company.name}: application emails, career pages and LinkedIn — on ${siteName}.`;
  const url = `${siteUrl}/company/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await load(slug);
  if (!company) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url: company.website ?? undefined,
    sameAs: company.linkedin ? [company.linkedin] : undefined,
    email: company.emails[0] ?? undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <CompanyPageView company={company} />
    </>
  );
}
