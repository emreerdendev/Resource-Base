import { createHash } from 'node:crypto'
import { createClient, type SanityClient } from '@sanity/client'

import {
  FILE_SUBCATEGORIES,
  FOLDER_CATEGORIES,
  HEADING_TAGS,
} from './mapping'
import type { ParsedResource } from './parse'

/** Deterministic doc id so re-running the import upserts instead of duplicating. */
function idFor(prefix: string, key: string): string {
  return `${prefix}.${createHash('sha1').update(key).digest('hex').slice(0, 24)}`
}

const catId = (slug: string) => idFor('category', slug)
const tagId = (slug: string) => idFor('tag', slug)
const resId = (url: string) => idFor('resource', url.toLowerCase())

export interface BuildResult {
  categories: Record<string, unknown>[]
  tags: Record<string, unknown>[]
  resources: Record<string, unknown>[]
}

/** Turn parsed rows into Sanity documents (categories, tags, resources). */
export function buildDocuments(parsed: ParsedResource[]): BuildResult {
  // Categories: top-level folders first, then file subcategories (parent ref).
  const categories: Record<string, unknown>[] = []
  for (const c of Object.values(FOLDER_CATEGORIES)) {
    categories.push({
      _id: catId(c.slug),
      _type: 'category',
      title: c.title,
      slug: { _type: 'slug', current: c.slug },
      icon: c.icon,
      domain: c.domain,
      order: c.order,
    })
  }
  // Map each file subcategory to its parent folder category.
  const folderOfFile = buildFolderOfFile()
  for (const [fileKey, sub] of Object.entries(FILE_SUBCATEGORIES)) {
    const folder = folderOfFile[fileKey]
    const parentSlug = folder ? FOLDER_CATEGORIES[folder].slug : undefined
    categories.push({
      _id: catId(sub.slug),
      _type: 'category',
      title: sub.title,
      slug: { _type: 'slug', current: sub.slug },
      icon: sub.icon,
      domain: folder ? FOLDER_CATEGORIES[folder].domain : 'general',
      order: 100,
      ...(parentSlug
        ? { parent: { _type: 'reference', _ref: catId(parentSlug) } }
        : {}),
    })
  }

  // Tags: explicit mapped ones + any topic tags discovered from headings.
  const tagsBySlug = new Map<string, Record<string, unknown>>()
  for (const t of Object.values(HEADING_TAGS)) {
    tagsBySlug.set(t.slug, {
      _id: tagId(t.slug),
      _type: 'tag',
      title: t.title,
      slug: { _type: 'slug', current: t.slug },
      kind: t.kind,
    })
  }

  // Resources (dedup by url; merge categories/tags/language on collision).
  const resBySlug = new Map<string, Record<string, unknown> & { _catSlugs: Set<string>; _tagSlugs: Set<string>; _langs: Set<string> }>()
  for (const r of parsed) {
    const id = resId(r.url)
    const existing = resBySlug.get(id)
    if (existing) {
      r.categorySlugs.forEach((s) => existing._catSlugs.add(s))
      r.tagSlugs.forEach((s) => existing._tagSlugs.add(s))
      r.language.forEach((l) => existing._langs.add(l))
      continue
    }
    resBySlug.set(id, {
      _id: id,
      _type: 'resource',
      name: r.name,
      slug: { _type: 'slug', current: slugify(r.name) },
      url: r.url,
      ...(r.author ? { author: r.author } : {}),
      pricing: 'free',
      featured: false,
      linkStatus: 'unchecked',
      submissionStatus: 'published',
      addedAt: MIGRATION_TIMESTAMP,
      _catSlugs: new Set(r.categorySlugs),
      _tagSlugs: new Set(r.tagSlugs),
      _langs: new Set(r.language),
    })
  }

  const resources = [...resBySlug.values()].map((r) => {
    const { _catSlugs, _tagSlugs, _langs, ...doc } = r
    return {
      ...doc,
      categories: [..._catSlugs].map((s) => ({ _type: 'reference', _ref: catId(s), _key: s })),
      tags: [..._tagSlugs].map((s) => ({ _type: 'reference', _ref: tagId(s), _key: s })),
      language: [..._langs],
    }
  })

  return { categories, tags: [...tagsBySlug.values()], resources }
}

/**
 * Push all documents in batched transactions. createOrReplace overwrites any
 * existing document with the same id — including later Studio edits.
 */
export async function importDocuments(
  client: SanityClient,
  { categories, tags, resources }: BuildResult
): Promise<void> {
  const all = [...categories, ...tags, ...resources]
  const BATCH = 50
  for (let i = 0; i < all.length; i += BATCH) {
    const tx = client.transaction()
    for (const doc of all.slice(i, i + BATCH)) {
      tx.createOrReplace(doc as { _id: string; _type: string })
    }
    await tx.commit({ visibility: 'async' })
    console.log(`  committed ${Math.min(i + BATCH, all.length)}/${all.length}`)
  }
}

export function makeWriteClient(): SanityClient {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !token) {
    throw new Error(
      'Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN in .env.local'
    )
  }
  return createClient({
    projectId,
    dataset,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-01',
    token,
    useCdn: false,
  })
}

// --- helpers ---

const MIGRATION_TIMESTAMP = '2024-01-01T00:00:00.000Z'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 90)
}

/**
 * The folder that owns each file key. Hard-coded grouping mirrors the source
 * tree so subcategories get the right parent reference.
 */
function buildFolderOfFile(): Record<string, string> {
  return {
    documents: 'resources',
    videos: 'resources',
    courses: 'resources',
    'certificate-programs': 'resources',
    'training-code-battles-sites': 'resources',
    'cheat-sheets': 'resources',
    roadmaps: 'resources',
    'github-repositories': 'resources',
    'resource-search': 'resources',
    'ui-design': 'assets',
    'libraries-plugins': 'assets',
    'ready-to-use': 'assets',
    templates: 'assets',
    icons: 'assets',
    colors: 'assets',
    fonts: 'assets',
    'stock-media-resources': 'assets',
    'css-generators': 'tools',
    hosts: 'tools',
    api: 'tools',
    'browser-extensions': 'extensions',
    'vscode-extensions': 'extensions',
    'ai-tools': 'useful-sections',
    'cv-resume-builders': 'useful-sections',
    'code-snippets': 'useful-sections',
    'mockup-generators': 'useful-sections',
    'github-generators': 'useful-sections',
  }
}
