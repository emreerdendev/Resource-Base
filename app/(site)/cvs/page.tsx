import type { Metadata } from "next";
import { shareMeta } from "@/lib/og";
import { CvsClient } from "@/components/cvs-client";

const DESCRIPTION =
  "Real CVs shared by the community, by field, seniority and technology — see how others present their experience.";

export const metadata: Metadata = {
  title: "CVs",
  description: DESCRIPTION,
  ...shareMeta("CVs", DESCRIPTION, "/cvs"),
};

// Static shell (intro in the HTML); the listing loads from the edge-cached
// /api/cvs and URL filters apply after hydration.
export default function CvsPage() {
  return <CvsClient mode="all" />;
}
