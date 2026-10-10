import type { Metadata } from "next";
import { CompanySubmitForm } from "@/components/company-submit-form";
import { SubmitForm } from "@/components/submit-form";
import { SubmitTabs } from "@/components/submit-tabs";
import type { Category } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCategoriesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "Contribute",
  description: "Suggest a company or a resource to add to the directory.",
};

// Auth enforced in middleware (PROTECTED_PAGES → redirects signed-out visitors),
// so no redundant server getUser(). The forms gate on the client too.
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; name?: string }>;
}) {
  const { type, name } = await searchParams;
  const isCompany = type === "company";
  const categories = isCompany
    ? []
    : await sanityFetch<Category[]>({ query: allCategoriesQuery, tags: ["category"] });

  return (
    <div className="mx-auto max-w-2xl">
      <SubmitTabs active={isCompany ? "company" : "resource"} />
      {isCompany ? (
        <CompanySubmitForm initialName={name?.slice(0, 120) ?? ""} />
      ) : (
        <SubmitForm categories={categories} />
      )}
    </div>
  );
}

