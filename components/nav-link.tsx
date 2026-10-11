"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A Link that prefetches on hover/focus instead of on sight. Header and footer
 * links are on every page, so viewport prefetching cost several Worker
 * requests per page view for pages most visitors never open.
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
