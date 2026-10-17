import type { Metadata } from "next";
import { CvsClient } from "@/components/cvs-client";

export const metadata: Metadata = {
  title: "Liked CVs",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the view still renders a
// sign-in prompt as a fallback.
export default function LikedCvsPage() {
  return <CvsClient mode="liked" />;
}
