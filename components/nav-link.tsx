"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";

/** How long the pointer has to rest on a link before it's prefetched. */
const HOVER_INTENT_MS = 80;

/**
 * The site's Link: prefetches on hover/focus instead of on sight. Next.js
 * prefetches a route as several per-segment requests, so prefetching every
 * link in view cost ~100 Worker requests for a handful of page views (and
 * tripped the per-IP limit). A short hover delay keeps a mouse sweeping
 * across a grid of links from prefetching each one; pressing the link still
 * prefetches before the click lands. Used everywhere in place of next/link.
 */
export function NavLink({
  href,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "prefetch"> & { href: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetch = () => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!saveData) router.prefetch(href);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // Menus move focus as the pointer passes over items, so focus waits too.
  const schedule = () => {
    cancel();
    timer.current = setTimeout(prefetch, HOVER_INTENT_MS);
  };
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(e) => {
        schedule();
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        cancel();
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        schedule();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        cancel();
        onBlur?.(e);
      }}
      onPointerDown={(e) => {
        cancel();
        prefetch();
        onPointerDown?.(e);
      }}
      {...props}
    />
  );
}
