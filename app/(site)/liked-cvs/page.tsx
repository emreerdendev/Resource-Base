import type { Metadata } from "next";
import { Suspense } from "react";
import { CvsClient } from "@/components/cvs-client";
import { ListPageSkeleton } from "@/components/skeletons";

export const metadata: Metadata = {
  title: "Liked CVs",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the view still renders a
// sign-in prompt as a fallback.
export default function LikedCvsPage() {
  // Suspense: the search is pre-filled from ?q= on the client.
  return (
    <Suspense fallback={<ListPageSkeleton actions={0} />}>
      <CvsClient mode="liked" />
    </Suspense>
  );
}
