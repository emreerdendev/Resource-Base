/**
 * One-time migration: parse the legacy VitePress markdown in _migration-source/
 * and import it into Sanity.
 *
 *   pnpm migrate:dry   # parse + summarise, write nothing
 *   pnpm migrate       # parse + import into Sanity
 *
 * Deterministic doc ids (hashed by url/slug) mean re-running doesn't duplicate —
 * but it REPLACES each document (createOrReplace), wiping every edit made in
 * the Studio since, link statuses and contributor credits. It was a one-time
 * import: don't run it against the live dataset again.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { parseAll } from './parse'
import { buildDocuments, importDocuments, makeWriteClient } from './import'

loadEnv({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(__dirname, '..', '..', '_migration-source')

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`\n📖 Parsing markdown in ${SOURCE_DIR} ...`)
  const parsed = parseAll(SOURCE_DIR)
  const docs = buildDocuments(parsed)

  console.log('\n📊 Summary')
  console.log(`   parsed links : ${parsed.length}`)
  console.log(`   categories   : ${docs.categories.length}`)
  console.log(`   tags         : ${docs.tags.length}`)
  console.log(`   resources    : ${docs.resources.length} (after url dedup)`)

  const withoutTags = docs.resources.filter(
    (r) => (r.tags as unknown[]).length === 0
  ).length
  console.log(`   resources w/o tags: ${withoutTags}`)

  console.log('\n   sample resources:')
  for (const r of docs.resources.slice(0, 5)) {
    console.log(
      `     • ${r.name} → ${r.url}  [cats:${(r.categories as unknown[]).length} tags:${(r.tags as unknown[]).length} lang:${(r.language as string[]).join(',')}]`
    )
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete — nothing written.\n')
    return
  }

  console.log('\n🚀 Importing into Sanity ...')
  const client = makeWriteClient()
  await importDocuments(client, docs)
  console.log('\n✅ Import complete.\n')
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
