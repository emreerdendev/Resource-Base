/**
 * The Sanity dataset is public (the free plan has no private datasets), so
 * submissions must not carry personal data. The app no longer writes the
 * submitter's email or a signed CV link; this removes them from older
 * submissions: emails are unset, CV links become the admin-only plain URL.
 *
 *   pnpm tsx scripts/scrub-public-submissions.ts          # show what changes
 *   pnpm tsx scripts/scrub-public-submissions.ts --apply  # write it
 */
import { config as loadEnv } from 'dotenv'
import { createClient } from '@sanity/client'

loadEnv({ path: '.env.local' })

const apply = process.argv.includes('--apply')
const site = 'https://resource-base.com'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '77o1dw6w',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-10-01',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
})

async function main() {
  const docs = await client.fetch<{ _id: string; email?: string; cvId?: string; cvFileUrl?: string }[]>(
    `*[_type == "submission" && (defined(email) || (defined(cvFileUrl) && cvFileUrl match "*sig=*"))]{ _id, email, cvId, cvFileUrl }`,
  )
  console.log(`${docs.length} submissions to clean`)
  if (!apply) {
    for (const d of docs) console.log(`- ${d._id}: ${d.email ? 'email' : ''} ${d.cvFileUrl?.includes('sig=') ? 'cv link' : ''}`)
    console.log('Dry run. Re-run with --apply to write.')
  } else {
    const tx = client.transaction()
    for (const d of docs) {
      tx.patch(d._id, (p) => {
        let patch = p.unset(['email'])
        if (d.cvId && d.cvFileUrl?.includes('sig=')) patch = patch.set({ cvFileUrl: `${site}/api/cv/${d.cvId}/file` })
        return patch
      })
    }
    await tx.commit()
    console.log('Done.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
