import { notFound } from "next/navigation";
import { loadCompany } from "./data";

/**
 * Unknown slugs 404 here, above this segment's loading boundary. Inside it
 * (in page.tsx) the 404 would already be streaming behind the skeleton, so it
 * went out as a cacheable 200. The document itself is checked too (the page
 * reuses the same fetch), so a removed one 404s even where the published-slug
 * list hasn't caught up yet.
 */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  if (!(await loadCompany((await params).slug))) notFound();
  return children;
}
