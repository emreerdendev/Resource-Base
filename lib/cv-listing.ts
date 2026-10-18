import type { CvListing } from "@/lib/types";

let listing: Promise<CvListing[]> | null = null;
let stale = false;

/** Published CVs from the cached /api/cvs, fetched once per page load. */
export function loadCvListing(): Promise<CvListing[]> {
  const init: RequestInit | undefined = stale ? { cache: "reload" } : undefined;
  stale = false;
  listing ??= fetch("/api/cvs", init)
    .then((r) => (r.ok ? (r.json() as Promise<CvListing[]>) : Promise.reject(r.status)))
    .catch((err) => {
      listing = null;
      throw err;
    });
  return listing;
}

/** After changing your own CV: the next load skips the browser's copy. */
export function forgetCvListing() {
  listing = null;
  stale = true;
}
