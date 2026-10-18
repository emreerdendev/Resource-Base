"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * The site's Link: prefetches on hover/focus instead of on sight. Next.js
 * prefetches a route as several per-segment requests, so prefetching every
 * link in view cost ~100 Worker requests for a handful of page views (and
 * tripped the per-IP limit). Used everywhere in place of next/link.
 */
export function NavLink({
  href,
  onMouseEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        router.prefetch(href);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        router.prefetch(href);
        onFocus?.(e);
      }}
      {...props}
    />
  );
}
