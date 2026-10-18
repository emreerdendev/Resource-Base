import type { SearchIndex } from "@/lib/types";

// One fetch per page load (the browser also keeps it 5 minutes), shared by the
// command palette and My Submissions; a failure retries on next use.
let indexPromise: Promise<SearchIndex> | null = null;

/** Every published resource and company, lightly (/api/search-index). */
export function loadSearchIndex(): Promise<SearchIndex> {
  indexPromise ??= fetch("/api/search-index")
    .then((r) => (r.ok ? (r.json() as Promise<SearchIndex>) : Promise.reject(r.status)))
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
}
