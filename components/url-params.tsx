"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

function Reader({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const qs = useSearchParams().toString();
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    latest.current(new URLSearchParams(qs));
  }, [qs]);
  return null;
}

/**
 * Hands the page's query string to `onChange` after hydration and whenever it
 * changes. Reading search params during render makes Next skip server
 * rendering up to the nearest Suspense boundary; isolating it in this empty
 * component keeps the list itself in the HTML (crawlers, first paint) while
 * URL filters still apply.
 */
export function UrlParams({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  return (
    <Suspense fallback={null}>
      <Reader onChange={onChange} />
    </Suspense>
  );
}
