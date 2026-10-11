import 'server-only'

import { sanityFetch } from './fetch'
import {
  categorySlugsQuery,
  companyIdsQuery,
  companySlugsQuery,
  resourceIdsQuery,
  resourceSlugsQuery,
  tagSlugsQuery,
} from './queries'

const SOURCES = {
  resource: { query: resourceSlugsQuery, tags: ['resource'] },
  company: { query: companySlugsQuery, tags: ['company'] },
  category: { query: categorySlugsQuery, tags: ['category'] },
  tag: { query: tagSlugsQuery, tags: ['tag'] },
} as const

export type SlugKind = keyof typeof SOURCES

/** Every published slug of a type — the same cached fetch generateStaticParams uses. */
export function listSlugs(kind: SlugKind) {
  const { query, tags } = SOURCES[kind]
  return sanityFetch<string[]>({ query, tags: [...tags] })
}

/**
 * Whether a slug exists, checked against the cached slug list. Detail pages
 * call this before their per-slug fetch so a made-up URL costs no Sanity
 * request and leaves no per-slug fetch entry in the KV cache.
 */
export async function hasSlug(kind: SlugKind, slug: string) {
  if (!slug || slug.length > 120) return false
  return (await listSlugs(kind)).includes(slug)
}

/**
 * Whether an id is a published resource. Gates every write keyed by a
 * client-supplied resource id (clicks, favorites) so junk ids can't add rows.
 */
export async function isResourceId(id: unknown): Promise<boolean> {
  if (!isPlainId(id)) return false
  return (await sanityFetch<string[]>({ query: resourceIdsQuery, tags: ['resource'] })).includes(id)
}

/** The published company ids, for validating tracker writes in bulk. */
export async function listCompanyIds(): Promise<Set<string>> {
  return new Set(await sanityFetch<string[]>({ query: companyIdsQuery, tags: ['company'] }))
}

/** A Sanity document id shape, never a draft (`drafts.…`). */
export function isPlainId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/.test(id) && !id.startsWith('drafts.')
}
