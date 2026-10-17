import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";
import { SubmitTabs } from "@/components/submit-tabs";
import type { Category } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "Add a Resource",
  description: "Suggest a resource to add to the directory.",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the form gates on the client too.
export default async function SubmitResourcePage() {
  const categories = await sanityFetch<Category[]>({
    query: allCategoriesQuery,
    tags: ["taxonomy"],
  });
  return (
    <div className="mx-auto max-w-2xl">
      <SubmitTabs active="resource" />
      <SubmitForm categories={categories} />
    </div>
  );
}
