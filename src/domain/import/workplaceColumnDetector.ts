import { normalizeText } from '../visualization/colorUtils'
import type { ParsedTable } from './columnTypeDetector'
import type { Workplace } from '../types/workplace'

const WORKPLACE_ALIASES = [
  'pracoviste',
  'pracoviště',
  'opzl',
  'opžl',
  'workplace',
  'cislo supervize',
  'číslo supervize',
]

export function detectWorkplaceColumn(
  headers: string[],
  rows: Record<string, string>[],
  workplaces: Workplace[],
): string | null {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeText(header),
  }))

  for (const alias of WORKPLACE_ALIASES) {
    const match = normalizedHeaders.find((item) => item.normalized === alias)
    if (match) return match.header
  }

  let bestHeader: string | null = null
  let bestScore = 0

  for (const header of headers) {
    const values = rows.map((row) => normalizeText(row[header] ?? '')).filter(Boolean)
    const score = values.filter((value) =>
      workplaces.some((workplace) => normalizeText(workplace.name) === value),
    ).length

    if (score > bestScore) {
      bestScore = score
      bestHeader = header
    }
  }

  if (bestHeader && bestScore > 0) return bestHeader
  return headers[0] ?? null
}

export function excludeWorkplaceColumn(table: ParsedTable, workplaceColumn: string | null): string[] {
  return table.headers.filter((header) => header !== workplaceColumn)
}
