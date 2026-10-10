/**
 * Turn the Notion "Şirketler" CSV export into a clean, public-safe seed file
 * (scripts/companies/data/companies.json) that `pnpm companies:import` loads.
 *
 *   pnpm companies:build "/path/to/export.csv"
 *
 * The raw export is NOT committed: it holds personal LinkedIn profiles of HR
 * staff (the IK-* columns) and private application statuses. Only company-level
 * public contact info survives this step:
 *  - every IK-Çalışan / IK-Ç2..n column is ignored,
 *  - personal-looking emails (first.last@) in the secondary email column are
 *    dropped, generic inboxes (hr@, careers@, info@ …) are kept,
 *  - the personal "Durum" (applied / rejected) column is ignored.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ApplicationChannel, City, Sector, WorkModel } from '../../lib/company-taxonomy'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'data', 'companies.json')

export interface CompanySeed {
  name: string
  slug: string
  website?: string
  linkedin?: string
  emails: string[]
  careerLinks: string[]
  channels: ApplicationChannel[]
  cities: City[]
  workModels: WorkModel[]
  sectors: Sector[]
  clients: string[]
}

/* --------------------------------- parsing -------------------------------- */

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/* -------------------------------- cleaning -------------------------------- */

const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
}

export function slugify(input: string): string {
  return input
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

function normalizeUrl(raw: string): string | undefined {
  let v = raw.trim()
  if (!v || v.includes('@')) return undefined
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  try {
    const u = new URL(v)
    return u.toString()
  } catch {
    return undefined
  }
}

const isLinkedin = (url: string) => /(^|\.)linkedin\.com$/i.test(new URL(url).hostname)

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function splitEmails(raw: string): string[] {
  return raw
    .split(/\s+-\s+|[,;\s]+/)
    .map((e) => e.trim().replace(/^https?:\/\//i, '').toLowerCase())
    .filter((e) => EMAIL_RE.test(e))
}

/** first.last@company — a named employee, not a company inbox. */
const looksPersonal = (email: string) => /^[a-z]+\.[a-z]+@/i.test(email) && !/^hr\./i.test(email)

const CHANNELS: Record<string, ApplicationChannel> = {
  Mail: 'email',
  'Website/Platform': 'career',
  LinkedIn: 'linkedin',
  Mesaj: 'message',
  'IK/Çalışan': 'hr',
}

const LOCATIONS: Record<string, City | WorkModel> = {
  İstanbul: 'istanbul',
  Ankara: 'ankara',
  İzmir: 'izmir',
  Remote: 'remote',
  Hybrid: 'hybrid',
}

/** "Alan" values that are a sector; everything else is a named client. */
const SECTOR_TAGS: Record<string, Sector> = {
  Oyun: 'gaming',
  Mobil: 'mobile',
  Banka: 'banking',
  Firma: 'consulting',
}

const CLIENT_NAMES: Record<string, string> = {
  'Turk Telekom': 'Türk Telekom',
  KoçAilem: 'Koç Ailem',
}

/** Light, editable-later sector hints from the company name. */
function sectorsFromName(name: string): Sector[] {
  const out: Sector[] = []
  if (/games?\b/i.test(name)) out.push('gaming')
  if (/bank|bankası|enpara/i.test(name)) out.push('banking')
  if (/security|siber/i.test(name)) out.push('cybersecurity')
  if (/recruitment|\bhr\b|talent|hire/i.test(name)) out.push('recruitment')
  if (/\bai\b|\.ai$/i.test(name)) out.push('ai')
  if (/defense|baykar/i.test(name)) out.push('defense')
  return out
}

/** Rows exported without a name — named after their site. */
const NAME_FROM_HOST: Record<string, string> = {
  'gameguru.net': 'GameGuru',
  'pinegames.com': 'Pine Games',
  'brew-games.com': 'Brew Games',
  'loomgames.com': 'Loom Games',
}

/** Known data-entry slips in the export (wrong value copied across rows). */
const DROP_EMAILS: Record<string, string[]> = {
  'Arute Solutions': ['contact@orema.com.tr'],
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/* ---------------------------------- build --------------------------------- */

export function buildSeeds(csv: string): CompanySeed[] {
  const [header, ...rows] = parseCsv(csv.replace(/^﻿/, ''))
  const col = (name: string) => header.indexOf(name)
  const get = (row: string[], name: string) => (row[col(name)] ?? '').trim()

  const bySlug = new Map<string, CompanySeed>()

  for (const row of rows) {
    const websiteRaw = normalizeUrl(get(row, 'Website URL'))
    let name = get(row, 'Şirket Adı')
    if (!name && websiteRaw) name = NAME_FROM_HOST[new URL(websiteRaw).hostname.replace(/^www\./, '')] ?? ''
    if (!name) continue

    const links = [websiteRaw, ...['W2', 'Platform URL', 'P2'].map((c) => normalizeUrl(get(row, c)))].filter(
      (u): u is string => Boolean(u)
    )
    const linkedin = links.find(isLinkedin)
    const website = websiteRaw && !isLinkedin(websiteRaw) ? websiteRaw : undefined
    const careerLinks = links.slice(1).filter((u) => !isLinkedin(u))

    const dropped = DROP_EMAILS[name] ?? []
    const emails = [
      ...splitEmails(get(row, 'Email')),
      ...splitEmails(get(row, 'E2')).filter((e) => !looksPersonal(e)),
    ].filter((e) => !dropped.includes(e))

    const channels = get(row, 'Başvuru Platformu')
      .split(',')
      .map((c) => CHANNELS[c.trim()])
      .filter(Boolean)
      // "Mail" without a surviving address isn't actionable for anyone else.
      .filter((c) => c !== 'email' || emails.length > 0)
    if (emails.length) channels.push('email')
    if (careerLinks.length) channels.push('career')
    if (linkedin) channels.push('linkedin')

    const locs = get(row, 'Çalışma Konumu')
      .split(',')
      .map((l) => LOCATIONS[l.trim()])
      .filter(Boolean)

    const areaTags = [get(row, 'Alan'), get(row, 'Alan (1)')]
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter(Boolean)

    const seed: CompanySeed = {
      name,
      slug: slugify(name),
      website,
      linkedin,
      emails,
      careerLinks,
      channels: channels as ApplicationChannel[],
      cities: locs.filter((l): l is City => ['istanbul', 'ankara', 'izmir'].includes(l)),
      workModels: locs.filter((l): l is WorkModel => ['remote', 'hybrid'].includes(l)),
      sectors: [
        ...areaTags.map((a) => SECTOR_TAGS[a]).filter(Boolean),
        ...sectorsFromName(name),
      ],
      clients: areaTags.filter((a) => !SECTOR_TAGS[a]).map((a) => CLIENT_NAMES[a] ?? a),
    }

    // Duplicate rows (same company entered twice) are merged.
    const prev = bySlug.get(seed.slug)
    bySlug.set(
      seed.slug,
      prev
        ? {
            ...prev,
            website: prev.website ?? seed.website,
            linkedin: prev.linkedin ?? seed.linkedin,
            emails: [...prev.emails, ...seed.emails],
            careerLinks: [...prev.careerLinks, ...seed.careerLinks],
            channels: [...prev.channels, ...seed.channels],
            cities: [...prev.cities, ...seed.cities],
            workModels: [...prev.workModels, ...seed.workModels],
            sectors: [...prev.sectors, ...seed.sectors],
            clients: [...prev.clients, ...seed.clients],
          }
        : seed
    )
  }

  return [...bySlug.values()]
    .map((c) => ({
      ...c,
      emails: uniq(c.emails),
      careerLinks: uniq(c.careerLinks),
      channels: uniq(c.channels),
      cities: uniq(c.cities),
      workModels: uniq(c.workModels),
      sectors: uniq(c.sectors),
      clients: uniq(c.clients),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: pnpm companies:build <path-to-notion-export.csv>')
    process.exit(1)
  }
  const seeds = buildSeeds(readFileSync(input, 'utf8'))
  writeFileSync(OUT, JSON.stringify(seeds, null, 2) + '\n')
  console.log(`✅ ${seeds.length} companies → ${OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
