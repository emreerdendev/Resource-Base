import type { Metadata } from "next";
import { CvsClient } from "@/components/cvs-client";

export const metadata: Metadata = {
  title: "CVs",
  description:
    "Real CVs shared by the community, by field, seniority and technology — see how others present their experience.",
  alternates: { canonical: "/cvs" },
};

// Static shell (intro in the HTML); the listing loads from the edge-cached
// /api/cvs and URL filters apply after hydration.
export default function CvsPage() {
  return <CvsClient mode="all" />;
}
