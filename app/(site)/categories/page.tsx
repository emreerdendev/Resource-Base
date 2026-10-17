import type { Metadata } from "next";
import { shareMeta } from "@/lib/og";
import { CategoriesClient } from "@/components/categories-client";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery } from "@/sanity/lib/queries";
import type { Category } from "@/lib/types";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse every category in the directory.",
  ...shareMeta("Categories", "Browse every category in the directory.", "/categories"),
};

export default async function CategoriesPage() {
  const categories = await sanityFetch<Category[]>({
    query: allCategoriesQuery,
    tags: ["taxonomy", "resource-list"],
  });

  return <CategoriesClient categories={categories} />;
}
