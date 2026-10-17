/**
 * Centralised Sanity environment access. Imported by both the Studio config
 * and the Next.js data layer, so it must stay isomorphic (no server-only APIs).
 */

// Read from the Next.js (NEXT_PUBLIC_*) prefix OR the Sanity CLI/Vite
// (SANITY_STUDIO_*) prefix, so the same config works for `next build` and
// `sanity deploy`. These values are public, non-secret.
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ||
  process.env.SANITY_STUDIO_API_VERSION ||
  '2024-10-01'

export const dataset = assertValue(
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
    process.env.SANITY_STUDIO_DATASET ||
    'production',
  'Missing environment variable: NEXT_PUBLIC_SANITY_DATASET'
)

// Public, non-secret; the fallback lets `sanity deploy` run without env files.
export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    process.env.SANITY_STUDIO_PROJECT_ID ||
    '77o1dw6w',
  'Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID'
)

function assertValue<T>(v: T | undefined, errorMessage: string): T {
  if (v === undefined) {
    throw new Error(errorMessage)
  }
  return v
}
