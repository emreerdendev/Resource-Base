import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicProfile } from "@/lib/profile-actions";
import { sanityFetch } from "@/sanity/lib/fetch";
import {
  allCategoriesQuery,
  allCompaniesQuery,
  resourcesBySubmitterQuery,
} from "@/sanity/lib/queries";
import { PublicProfileView } from "@/components/public-profile";
import type { Category, Company, PublicProfile, Resource } from "@/lib/types";

// Profiles are reachable only via resource-card links — keep them out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profile = (await fetchPublicProfile(username)) as PublicProfile | null;
  if (!profile) notFound();

  // All queries are tag-cached + CDN-served, so this stays cheap. Categories
  // feed the owner-only "My submissions" resubmit modal; companies resolve the
  // owner-only application tracker.
  const [resources, categories, companies] = await Promise.all([
    sanityFetch<Resource[]>({
      query: resourcesBySubmitterQuery,
      params: { userId: profile.id },
      tags: ["resource"],
    }),
    sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["category"] }),
    sanityFetch<Company[]>({ query: allCompaniesQuery, tags: ["company"] }),
  ]);

  return (
    <PublicProfileView
      profile={profile}
      resources={resources}
      categories={categories}
      companies={companies}
    />
  );
}
