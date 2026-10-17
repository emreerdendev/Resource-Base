import type { Metadata } from "next";

// A one-off account step: nothing for search engines here.
export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
