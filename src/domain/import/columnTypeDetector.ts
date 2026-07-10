import { normalizeText } from '../visualization/colorUtils'

export interface ParsedTable {
  headers: string[]
  rows: Record<string, string>[]
}

export function detectColumnTypes(
  headers: string[],
  rows: Record<string, string>[],
): Record<string, 'number' | 'text' | 'percent'> {
  const result: Record<string, 'number' | 'text' | 'percent'> = {}

  for (const header of headers) {
    const headerNormalized = normalizeText(header)
    if (
      headerNormalized.includes('podil') ||
      headerNormalized.includes('procent') ||
      headerNormalized.includes('percent')
    ) {
      result[header] = 'percent'
      continue
    }

    const values = rows
      .map((row) => row[header] ?? '')
      .map((value) => String(value).trim())
      .filter(Boolean)

    if (values.length === 0) {
      result[header] = 'text'
      continue
    }

    const percentCount = values.filter((value) => value.includes('%')).length
    if (percentCount / values.length > 0.5) {
      result[header] = 'percent'
      continue
    }

    const numericCount = values.filter((value) => {
      const normalized = value.replace(',', '.')
      return normalized !== '' && Number.isFinite(Number(normalized))
    }).length

    result[header] = numericCount / values.length > 0.7 ? 'number' : 'text'
  }

  return result
}

export function toColumnKey(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function uniqueColumnKey(base: string, used: Set<string>): string {
  let key = base || 'column'
  let index = 2
  while (used.has(key)) {
    key = `${base}_${index}`
    index += 1
  }
  used.add(key)
  return key
}
