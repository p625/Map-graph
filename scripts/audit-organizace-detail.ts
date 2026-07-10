import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { districts } from '../src/data/seed/districts.ts'
import { normalizeText } from '../src/domain/visualization/colorUtils.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

function trim(s: unknown): string {
  return String(s ?? '').trim()
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function unique<T>(items: T[], key: (item: T) => string): string[] {
  return [...new Set(items.map(key))].sort()
}

const buffer = readFileSync(file)
const wb = XLSX.read(buffer, { type: 'buffer' })
const sheet = wb.Sheets[wb.SheetNames[0]!]!
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

type Row = {
  okres: string
  lpis: string
  opzl: string
  vedouci: string
  orgUnit: string
  ro: string
}

const parsed: Row[] = rows.map((r) => ({
  okres: trim(r['Okresy']),
  lpis: trim(r['Názvy OPŽL z LPIS']),
  opzl: trim(r['OPŽL']),
  vedouci: trim(r['Vedoucí']),
  orgUnit: trim(r['Organizační složka']),
  ro: trim(r['RO']),
}))

console.log('=== SUMMARY ===')
console.log('Rows:', parsed.length)
console.log('Unique RO:', unique(parsed, (r) => r.ro).length)
console.log('Unique OPŽL:', unique(parsed, (r) => r.opzl).length)
console.log('Unique Vedoucí:', unique(parsed, (r) => r.vedouci).length)
console.log('Unique OrgUnit:', unique(parsed, (r) => r.orgUnit).length)
console.log('Unique Okresy:', unique(parsed, (r) => r.okres).length)

console.log('\n=== RO (regions) ===')
for (const ro of unique(parsed, (r) => r.ro)) {
  const count = parsed.filter((r) => r.ro === ro).length
  const opzls = unique(
    parsed.filter((r) => r.ro === ro),
    (r) => r.opzl,
  )
  console.log(`  ${ro}: ${count} okresů, ${opzls.length} OPŽL`)
}

console.log('\n=== OPŽL list ===')
for (const opzl of unique(parsed, (r) => r.opzl)) {
  const rs = parsed.filter((r) => r.opzl === opzl)
  const okresy = rs.map((r) => r.okres)
  const vedouci = unique(rs, (r) => r.vedouci)
  const org = unique(rs, (r) => r.orgUnit)
  const ro = unique(rs, (r) => r.ro)
  const flags: string[] = []
  if (vedouci.length > 1) flags.push(`MULTI-LEADER:${vedouci.join('|')}`)
  if (org.length > 1) flags.push(`MULTI-ORG:${org.join('|')}`)
  if (ro.length > 1) flags.push(`MULTI-RO:${ro.join('|')}`)
  console.log(
    `  ${opzl} (${okresy.length} okresů)${flags.length ? ' ⚠ ' + flags.join('; ') : ''}`,
  )
}

console.log('\n=== Vedoucí → počet OPŽL ===')
const leaderOpzl = new Map<string, Set<string>>()
for (const r of parsed) {
  if (!leaderOpzl.has(r.vedouci)) leaderOpzl.set(r.vedouci, new Set())
  leaderOpzl.get(r.vedouci)!.add(r.opzl)
}
for (const [leader, opzls] of [...leaderOpzl.entries()].sort()) {
  console.log(`  ${leader}: ${opzls.size} OPŽL → ${[...opzls].join(', ')}`)
}

console.log('\n=== OrgUnit → počet OPŽL ===')
const orgOpzl = new Map<string, Set<string>>()
for (const r of parsed) {
  if (!orgOpzl.has(r.orgUnit)) orgOpzl.set(r.orgUnit, new Set())
  orgOpzl.get(r.orgUnit)!.add(r.opzl)
}
for (const [org, opzls] of [...orgOpzl.entries()].sort()) {
  console.log(`  ${org}: ${opzls.size} OPŽL`)
}

console.log('\n=== Empty values ===')
for (const field of ['okres', 'lpis', 'opzl', 'vedouci', 'orgUnit', 'ro'] as const) {
  const empty = parsed.filter((r) => !r[field]).length
  if (empty) console.log(`  ${field}: ${empty} empty`)
}

console.log('\n=== District matching (okres → seed districts) ===')
const districtByNormName = new Map(districts.map((d) => [normalizeText(d.name), d]))
const unmatched: string[] = []
const matched: string[] = []
for (const r of parsed) {
  const norm = normalizeText(r.okres)
  if (districtByNormName.has(norm)) matched.push(r.okres)
  else unmatched.push(r.okres)
}
console.log('Matched:', matched.length, 'Unmatched:', unmatched.length)
if (unmatched.length) console.log('Unmatched okresy:', unmatched.join(', '))

console.log('\n=== Okresy in seed NOT in Excel ===')
const excelNorm = new Set(parsed.map((r) => normalizeText(r.okres)))
const missingInExcel = districts.filter((d) => !excelNorm.has(normalizeText(d.name)))
console.log('Count:', missingInExcel.length)
if (missingInExcel.length) console.log(missingInExcel.map((d) => d.name).join(', '))

console.log('\n=== Duplicate okres rows ===')
const okresCounts = countBy(parsed, (r) => normalizeText(r.okres))
const dupes = [...okresCounts.entries()].filter(([, c]) => c > 1)
console.log('Duplicates:', dupes.length)

console.log('\n=== Inconsistent OPŽL per okres (should be 1:1 in source) ===')
// N/A - each row is one okres

console.log('\n=== Special: Králův Dvůr ===')
const kdv = parsed.find((r) => r.okres.includes('Král'))
if (kdv) console.log(JSON.stringify(kdv))

console.log('\n=== Rows with empty LPIS name ===')
const emptyLpis = parsed.filter((r) => !r.lpis)
console.log('Count:', emptyLpis.length)
for (const r of emptyLpis) {
  console.log(`  ${r.okres} → OPŽL: ${r.opzl}`)
}

// Compare with seed workplaces
import { workplaces } from '../src/data/seed/workplaces.ts'

const excelOpzl = unique(parsed, (r) => r.opzl)
const seedNames = workplaces.map((w) => w.name)
const inExcelNotSeed = excelOpzl.filter(
  (n) => !seedNames.some((s) => normalizeText(s) === normalizeText(n)),
)
const inSeedNotExcel = seedNames.filter(
  (n) => !excelOpzl.some((e) => normalizeText(e) === normalizeText(n)),
)
console.log('\n=== Excel OPŽL vs seed workplaces ===')
console.log('In Excel not in seed:', inExcelNotSeed.join(', ') || '(none)')
console.log('In seed not in Excel:', inSeedNotExcel.join(', ') || '(none)')

console.log('\n=== Suggested district aliases for import ===')
for (const r of parsed) {
  const norm = normalizeText(r.okres)
  if (!districtByNormName.has(norm)) {
    console.log(`  "${r.okres}" → needs alias (OPŽL: ${r.opzl})`)
  }
}
