import type { Metadata } from "next";
import { ContributionsClient } from "@/components/contributions-client";

export const metadata: Metadata = {
  title: "Contributions",
  description: "Everyone who has contributed to Resource Base.",
  // Lists people (like the profiles it links to, which aren't indexed).
  robots: { index: false, follow: false },
};

// Static shell; the list loads from the edge-cached /api/contributions.
export default function ContributionsPage() {
  return <ContributionsClient />;
}
