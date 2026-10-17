import type { CvListing } from "@/lib/types";

let listing: Promise<CvListing[]> | null = null;

/** Published CVs from the cached /api/cvs, fetched once per page load. */
export function loadCvListing(): Promise<CvListing[]> {
  listing ??= fetch("/api/cvs")
    .then((r) => (r.ok ? (r.json() as Promise<CvListing[]>) : Promise.reject(r.status)))
    .catch((err) => {
      listing = null;
      throw err;
    });
  return listing;
}
