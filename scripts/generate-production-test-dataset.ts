/**
 * Generuje realistický testovací dataset pro Phase 5A.1.
 * Spuštění: npm run generate-production-test-dataset
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { workplaces } from '../src/data/seed/workplaces.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'data', 'raw', 'production-test-opzl.csv')

const LPIS_VARIANTS: Record<string, string> = {
  'wp-042': 'OPŽL Praha',
  'wp-041': 'Plzen',
  'wp-037': 'OPŽL Opava',
  'wp-025': 'Beroun',
  'wp-003': 'Brno-město',
  'wp-059': 'Ústí nad Lab.',
}

const CATEGORIES = ['Nízké', 'Střední', 'Vysoké', ''] as const
const EMPTY_NUMERIC = new Set(['wp-015', 'wp-033', 'wp-058'])

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const headers = [
  'Názvy OPŽL z LPIS',
  'Počet žádostí',
  'Vyřízeno ks',
  'Podíl vyřízení',
  'Kategorie rizika',
  'Poznámka',
]

const rows: string[][] = []

for (const workplace of workplaces) {
  const label = LPIS_VARIANTS[workplace.id] ?? workplace.name
  const numericId = Number(workplace.id.replace('wp-', '')) || 0
  const pocet = EMPTY_NUMERIC.has(workplace.id) ? '' : String(40 + (numericId % 120))
  const vyrizeno = EMPTY_NUMERIC.has(workplace.id) ? '' : String(20 + (numericId % 80))
  const percent = EMPTY_NUMERIC.has(workplace.id)
    ? ''
    : `${(55 + (numericId % 40)).toString()},${numericId % 10} %`
  const category = CATEGORIES[numericId % CATEGORIES.length] ?? 'Střední'
  const note = numericId % 5 === 0 ? 'Kontrola vzorku' : ''
  rows.push([label, pocet, vyrizeno, percent, category, note])
}

rows.push(['Testovice OPŽL', '10', '5', '50,0 %', 'Vysoké', 'nespárované'])
rows.push(['Brno venkov', '33', '20', '60,6 %', 'Střední', 'nejasné párování'])

const csv = [
  headers.join(','),
  ...rows.map((row) => row.map(escapeCsv).join(',')),
].join('\n')

writeFileSync(outPath, `\uFEFF${csv}`, 'utf8')
console.log(`Zapsáno: ${outPath}`)
console.log(`Řádků: ${rows.length} (${workplaces.length} OPŽL + 2 testovací)`)
