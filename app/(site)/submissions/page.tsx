import type { Metadata } from "next";
import { SubmissionsPageView } from "@/components/submissions-page";
import type { Category } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "My submissions",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the view still renders a
// sign-in prompt as a UX fallback. Categories feed the resubmit form.
export default async function SubmissionsPage() {
  const categories = await sanityFetch<Category[]>({
    query: allCategoriesQuery,
    tags: ["category"],
  });
  return <SubmissionsPageView categories={categories} />;
}
