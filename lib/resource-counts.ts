import type { ResourceCounts } from "@/lib/types";

let counts: Promise<ResourceCounts> | null = null;

/**
 * Public click + favorite counts, fetched once per page load and shared by
 * both count providers. Only requested once a component actually shows counts,
 * so pages without resource cards never pay for it. A failure retries next call.
 */
export function loadResourceCounts(): Promise<ResourceCounts> {
  counts ??= fetch("/api/counts")
    .then((r) => (r.ok ? (r.json() as Promise<ResourceCounts>) : Promise.reject(r.status)))
    .catch((err) => {
      counts = null;
      throw err;
    });
  return counts;
}
