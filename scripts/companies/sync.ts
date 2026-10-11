/**
 * Backfill application links from the seed into companies already in Sanity.
 *
 *   pnpm companies:sync:dry   # list what would change, write nothing
 *   pnpm companies:sync       # apply
 *
 * Additive only: missing career links / channels are appended; nothing is
 * removed or overwritten, so edits made in the Studio are kept.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@sanity/client'

import type { CompanySeed } from './build'

loadEnv({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED = join(__dirname, 'data', 'companies.json')

type Live = { _id: string; careerLinks?: string[]; channels?: string[] }

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !token) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN must be set')
  const client = createClient({
    projectId,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-10-01',
    token,
    useCdn: false,
  })

  const seeds = JSON.parse(readFileSync(SEED, 'utf8')) as CompanySeed[]
  const live = await client.fetch<Live[]>(
    `*[_type == "company" && _id in $ids]{ _id, careerLinks, channels }`,
    { ids: seeds.map((s) => `company-${s.slug}`) },
  )
  const byId = new Map(live.map((d) => [d._id, d]))

  const patches = seeds.flatMap((s) => {
    const doc = byId.get(`company-${s.slug}`)
    if (!doc) return []
    const addLinks = s.careerLinks.filter((u) => !(doc.careerLinks ?? []).includes(u))
    const addChannels = s.channels.filter((c) => !(doc.channels ?? []).includes(c))
    if (!addLinks.length && !addChannels.length) return []
    return [{ id: doc._id, name: s.name, addLinks, addChannels }]
  })

  console.log(`\n📊 ${patches.length} companies need backfilling`)
  for (const p of patches) console.log(`   • ${p.name}: +${p.addLinks.join(', ') || '—'} ${p.addChannels.length ? `[${p.addChannels.join(', ')}]` : ''}`)
  if (dryRun || !patches.length) {
    console.log('\n✅ Dry run complete — nothing written.\n')
    return
  }

  const tx = client.transaction()
  // One append per patch: a patch holds a single insert operation, so two
  // appends in the same patch would silently drop the first.
  for (const p of patches) {
    tx.patch(p.id, (patch) => patch.setIfMissing({ careerLinks: [], channels: [] }))
    if (p.addLinks.length) tx.patch(p.id, (patch) => patch.append('careerLinks', p.addLinks))
    if (p.addChannels.length) tx.patch(p.id, (patch) => patch.append('channels', p.addChannels))
  }
  await tx.commit({ visibility: 'async' })
  console.log(`\n✅ Backfilled ${patches.length} companies.\n`)
}

main().catch((err) => {
  console.error('\n❌ Sync failed:', err)
  process.exit(1)
})
