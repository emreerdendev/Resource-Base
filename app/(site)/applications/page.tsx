import type { Metadata } from "next";
import { ApplicationsPageView } from "@/components/applications-page";
import type { Company } from "@/lib/types";
import { sanityFetch } from "@/sanity/lib/fetch";
import { allCompaniesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "My Applications",
  description: "Track the companies you've saved and applied to.",
  robots: { index: false, follow: false },
};

// Auth is enforced in middleware (PROTECTED_PAGES); the tracker still renders a
// sign-in prompt as a UX fallback.
export default async function ApplicationsPage() {
  const companies = await sanityFetch<Company[]>({
    query: allCompaniesQuery,
    tags: ["company"],
  });
  return <ApplicationsPageView companies={companies} />;
}
