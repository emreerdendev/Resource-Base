import { notFound, permanentRedirect } from "next/navigation";
import { getPublicProfile } from "@/lib/public-profile";
import { profilePath } from "@/lib/username";

/**
 * Unknown usernames 404 here, above the loading boundary (real 404 status).
 * /@emre and /@EMRE are the same profile; other spellings redirect to the
 * name as its owner wrote it.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const username = decodeURIComponent((await params).username);
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  if (username !== profile.username) permanentRedirect(profilePath(profile.username));
  return children;
}
