import type { Metadata } from "next";
import { shareMeta } from "@/lib/og";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of Resource Base.",
  ...shareMeta("Terms of Service", "The terms governing your use of Resource Base.", "/terms"),
};

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
