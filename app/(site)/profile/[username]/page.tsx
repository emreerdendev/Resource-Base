import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { getPublicProfile } from "@/lib/public-profile";
import { sanityFetch } from "@/sanity/lib/fetch";
import { resourcesBySubmitterQuery } from "@/sanity/lib/queries";
import { PublicProfileView } from "@/components/public-profile";
import type { Resource } from "@/lib/types";

// Profiles are reachable only via contributor links — keep them out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  // Contributions: published resources (Sanity, tag-cached) plus approved
  // company suggestions (counted from the D1 submissions mirror).
  const [resources, [{ companies }]] = await Promise.all([
    sanityFetch<Resource[]>({
      query: resourcesBySubmitterQuery,
      params: { userId: profile.id },
      tags: ["resource"],
    }),
    getDb()
      .select({ companies: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, profile.id),
          eq(submissions.kind, "company"),
          eq(submissions.status, "approved"),
        ),
      ),
  ]);

  return (
    <PublicProfileView profile={profile} resources={resources} companiesAdded={companies} />
  );
}
