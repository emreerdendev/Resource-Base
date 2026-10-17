"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Resets scroll to the top on every new page. Next.js' default scroll
 * restoration can return to a cached page at a non-zero offset, which — with
 * the sticky header — looks like the content opens "behind" the header.
 * Back/forward navigation is left alone, so the browser returns you to where
 * you were on the previous page.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const historyNav = useRef(false);
  useEffect(() => {
    const onPop = () => {
      historyNav.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (historyNav.current) {
      historyNav.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
