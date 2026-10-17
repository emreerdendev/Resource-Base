import type { Metadata } from "next";
import { CompanySubmitForm } from "@/components/company-submit-form";
import { SubmitTabs } from "@/components/submit-tabs";

export const metadata: Metadata = {
  title: "Suggest a Company",
  description: "Suggest a company to add to the directory, with how to apply to it.",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the form gates on the client
// too. ?name= pre-fills the company name (from an empty search or an import);
// ?resubmit=<id> starts from a rejected suggestion to edit and send again.
export default async function SubmitCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; resubmit?: string }>;
}) {
  const { name, resubmit } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <SubmitTabs active="company" />
      <CompanySubmitForm
        initialName={typeof name === "string" ? name.slice(0, 120) : ""}
        resubmitId={typeof resubmit === "string" ? resubmit.slice(0, 100) : undefined}
      />
    </div>
  );
}
