import type { Metadata } from "next";
import { shareMeta } from "@/lib/og";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Resource Base collects, uses and protects your data.",
  ...shareMeta("Privacy Policy", "How Resource Base collects, uses and protects your data.", "/privacy"),
};

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
