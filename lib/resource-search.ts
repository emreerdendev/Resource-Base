import { createSearch } from "@/lib/search";
import type { Resource } from "@/lib/types";

type Searchable = Pick<Resource, "name" | "author" | "description"> & {
  categories?: { title: string }[];
  tags?: { title: string }[];
};

/**
 * Resource search (directory + ⌘K): name first, then tags and categories,
 * then author, then description words. See createSearch.
 */
export function createResourceSearch<T extends Searchable>(resources: T[]) {
  return createSearch(resources, (r) => r.name, [
    { get: (r) => [...(r.tags ?? []).map((t) => t.title), ...(r.categories ?? []).map((c) => c.title)] },
    { get: (r) => (r.author ? [r.author] : []) },
    { get: (r) => (r.description ? [r.description] : []), match: "words" },
  ]);
}
