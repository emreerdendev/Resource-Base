import 'server-only'

import { client } from './client'

/**
 * Tag-based cached fetch. Pages render statically and are revalidated
 * on-demand when a Sanity webhook hits /api/revalidate (revalidateTag).
 * No redeploy needed for a content edit. The 1-day `revalidate` is only a
 * safety net for a missed webhook delivery — each expiry re-renders a page and
 * rewrites its KV entry, so it's kept long on purpose.
 */
export async function sanityFetch<T>({
  query,
  params = {},
  tags,
  revalidate = 86400,
}: {
  query: string
  params?: Record<string, unknown>
  tags: string[]
  revalidate?: number | false
}): Promise<T> {
  return client.fetch<T>(query, params, {
    next: { tags, revalidate },
  })
}
