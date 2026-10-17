import 'server-only'

import { siteUrl } from '@/lib/site'
import { client } from './client'
import { sanityFetch } from './fetch'
import {
  categorySlugsQuery,
  companyIdsQuery,
  companySlugsQuery,
  resourceIdsQuery,
  resourceSlugsQuery,
  tagSlugsQuery,
} from './queries'

/**
 * Published slug and id lists, used to turn made-up URLs into a 404 (and junk
 * ids into a 400) without a Sanity request per guess.
 *
 * They are kept in the Workers Cache API — not Next's data cache — on purpose:
 * a page that reads a list fetch inherits its tag, so every detail page would
 * be invalidated whenever any document of its type changed. This way a detail
 * page carries only its own document's tag. A list refreshes every 10 minutes
 * per location (and right away where the revalidate webhook lands), so a newly
 * published page can 404 for a few minutes elsewhere — 404s are never cached.
 */
const LISTS = {
  resource: resourceSlugsQuery,
  company: companySlugsQuery,
  category: categorySlugsQuery,
  tag: tagSlugsQuery,
  resourceIds: resourceIdsQuery,
  companyIds: companyIdsQuery,
} as const

export type ListName = keyof typeof LISTS
export type SlugKind = 'resource' | 'company' | 'category' | 'tag'

const LIST_TTL_SEC = 600

const listKey = (name: ListName) => `${siteUrl}/__lists/${name}`

function edgeCache(): Cache | undefined {
  return (globalThis.caches as unknown as { default?: Cache } | undefined)?.default
}

async function cachedList(name: ListName): Promise<string[]> {
  const cache = edgeCache()
  // Local dev has no Cache API: Next's data cache is fine there.
  if (!cache) return sanityFetch<string[]>({ query: LISTS[name], tags: [`list:${name}`] })
  const hit = await cache.match(listKey(name))
  if (hit) return (await hit.json()) as string[]
  const list = await client.fetch<string[]>(LISTS[name])
  await cache
    .put(
      listKey(name),
      new Response(JSON.stringify(list), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${LIST_TTL_SEC}` },
      }),
    )
    .catch(() => {})
  return list
}

/** Drop this location's cached lists (called by the revalidate webhook). */
export async function forgetLists(names: ListName[]) {
  const cache = edgeCache()
  if (!cache) return
  await Promise.all(names.map((n) => cache.delete(listKey(n)).catch(() => false)))
}

/** Whether a slug is published. Detail pages check it before their own fetch. */
export async function hasSlug(kind: SlugKind, slug: string) {
  if (!slug || slug.length > 120) return false
  return (await cachedList(kind)).includes(slug)
}

/**
 * Whether an id is a published resource. Gates every write keyed by a
 * client-supplied resource id (clicks, favorites) so junk ids can't add rows.
 */
export async function isResourceId(id: unknown): Promise<boolean> {
  if (!isPlainId(id)) return false
  return (await cachedList('resourceIds')).includes(id)
}

/** The published company ids, for validating tracker writes in bulk. */
export async function listCompanyIds(): Promise<Set<string>> {
  return new Set(await cachedList('companyIds'))
}

/** A Sanity document id shape, never a draft (`drafts.…`). */
export function isPlainId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(id) && !id.startsWith('drafts.')
}
