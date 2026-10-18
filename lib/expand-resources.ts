import type { Category, CategoryRef, CompactResource, Resource, Tag, TagRef } from "@/lib/types";

/**
 * Rebuild full resources from the compact list pages ship, using the category
 * and tag lists the page already has. Ids that no longer resolve are dropped,
 * as a dangling reference was before.
 */
export function expandResources(list: CompactResource[], categories: Category[], tags: Tag[]): Resource[] {
  const cats = new Map<string, CategoryRef>(
    categories.map((c) => [c._id, { _id: c._id, title: c.title, slug: c.slug, domain: c.domain }]),
  );
  const tgs = new Map<string, TagRef>(tags.map((t) => [t._id, { _id: t._id, title: t.title, slug: t.slug, kind: t.kind }]));
  return list.map(({ categoryIds, tagIds, ...rest }) => ({
    ...rest,
    categories: (categoryIds ?? []).flatMap((id) => cats.get(id) ?? []),
    tags: (tagIds ?? []).flatMap((id) => tgs.get(id) ?? []),
  }));
}
