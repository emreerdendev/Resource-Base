import { notFound } from "next/navigation";
import { hasSlug } from "@/sanity/lib/slugs";

/**
 * Unknown slugs 404 here, above this segment's loading boundary. Inside it
 * (in page.tsx) the 404 would already be streaming behind the skeleton, so it
 * went out as a cacheable 200.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  if (!(await hasSlug("company", (await params).slug))) notFound();
  return children;
}
