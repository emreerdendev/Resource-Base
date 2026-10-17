import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { fetchPublicEmail, getPublicProfile } from "@/lib/public-profile";
import { sanityFetch } from "@/sanity/lib/fetch";
import { resourcesBySubmitterQuery } from "@/sanity/lib/queries";
import { PublicProfileView } from "@/components/public-profile";
import type { Resource } from "@/lib/types";

// Profiles are reachable only via contributor links — keep them out of search.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const profile = await getPublicProfile((await params).username);
  const robots = { index: false, follow: false };
  if (!profile) return { robots };
  const name = profile.full_name ? `${profile.full_name} (@${profile.username})` : `@${profile.username}`;
  return { title: name, description: profile.bio ?? undefined, robots };
}

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
  const [resources, [{ companies }], publicEmail] = await Promise.all([
    sanityFetch<Resource[]>({
      query: resourcesBySubmitterQuery,
      params: { userId: profile.id },
      tags: ["resource-list"],
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
    // Only when the owner chose to show it.
    profile.show_email ? fetchPublicEmail(profile.id) : null,
  ]);

  return (
    <PublicProfileView
      profile={profile}
      resources={resources}
      companiesAdded={companies}
      publicEmail={publicEmail}
    />
  );
}
