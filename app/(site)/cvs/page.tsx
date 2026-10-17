import type { Metadata } from "next";
import { Suspense } from "react";
import { CvsClient } from "@/components/cvs-client";
import { ListPageSkeleton } from "@/components/skeletons";

export const metadata: Metadata = {
  title: "CVs",
  description:
    "Real CVs shared by the community, by field, seniority and technology — see how others present their experience.",
  alternates: { canonical: "/cvs" },
};

// Static shell; the listing loads from the edge-cached /api/cvs.
export default function CvsPage() {
  // Suspense: the search is pre-filled from ?q= on the client.
  return (
    <Suspense fallback={<ListPageSkeleton actions={1} />}>
      <CvsClient mode="all" />
    </Suspense>
  );
}
