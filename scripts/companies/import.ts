/**
 * Upsert the company seed (scripts/companies/data/companies.json) into Sanity.
 *
 *   pnpm companies:import:dry   # summarise, write nothing
 *   pnpm companies:import       # create missing companies
 *
 * Idempotent and non-destructive: deterministic ids (`company-<slug>`) plus
 * createIfNotExists mean re-running only adds new companies — edits made in
 * the Studio are never overwritten.
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

function toDocument(seed: CompanySeed, addedAt: string) {
  return {
    _id: `company-${seed.slug}`,
    _type: 'company',
    name: seed.name,
    slug: { _type: 'slug', current: seed.slug },
    ...(seed.website && { website: seed.website }),
    ...(seed.linkedin && { linkedin: seed.linkedin }),
    emails: seed.emails,
    careerLinks: seed.careerLinks,
    channels: seed.channels,
    cities: seed.cities,
    workModels: seed.workModels,
    sectors: seed.sectors,
    clients: seed.clients,
    status: 'published',
    addedAt,
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const seeds = JSON.parse(readFileSync(SEED, 'utf8')) as CompanySeed[]
  const addedAt = new Date().toISOString()
  const docs = seeds.map((s) => toDocument(s, addedAt))

  console.log(`\n📊 ${docs.length} companies in seed`)
  console.log(`   with email     : ${seeds.filter((s) => s.emails.length).length}`)
  console.log(`   with career url: ${seeds.filter((s) => s.careerLinks.length).length}`)
  console.log(`   with linkedin  : ${seeds.filter((s) => s.linkedin).length}`)

  if (dryRun) {
    console.log('\n✅ Dry run complete — nothing written.\n')
    return
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !token) {
    throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN must be set in .env.local')
  }
  const client = createClient({
    projectId,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-10-01',
    token,
    useCdn: false,
  })

  // Batches keep each transaction well under Sanity's mutation size limit.
  for (let i = 0; i < docs.length; i += 50) {
    const tx = client.transaction()
    for (const doc of docs.slice(i, i + 50)) tx.createIfNotExists(doc)
    await tx.commit({ visibility: 'async' })
    console.log(`   ✓ ${Math.min(i + 50, docs.length)}/${docs.length}`)
  }
  console.log('\n✅ Import complete.\n')
}

main().catch((err) => {
  console.error('\n❌ Import failed:', err)
  process.exit(1)
})
