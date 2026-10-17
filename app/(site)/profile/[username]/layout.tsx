import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/public-profile";

/** Unknown usernames 404 here, above the loading boundary (real 404 status). */
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  if (!(await getPublicProfile((await params).username))) notFound();
  return children;
}
