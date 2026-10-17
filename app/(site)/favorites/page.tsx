import type { Metadata } from "next";
import { FavoritesClient } from "@/components/favorites-client";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allResourcesQuery } from "@/sanity/lib/queries";
import type { Resource } from "@/lib/types";

export const metadata: Metadata = {
  title: "Favorite Resources",
  description: "Resources you've saved.",
  robots: { index: false, follow: false },
};

// Auth is enforced in middleware (PROTECTED_PAGES → redirects signed-out
// visitors home before render), so the page skips a redundant getUser()
// round-trip. FavoritesClient still renders a sign-in prompt as a UX fallback.
export default async function FavoritesPage() {
  const resources = await sanityFetch<Resource[]>({
    query: allResourcesQuery,
    tags: ["resource"],
  });
  return <FavoritesClient resources={resources} />;
}
