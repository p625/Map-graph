import * as XLSX from 'xlsx'
import type { ParsedTable } from './columnTypeDetector'

function normalizeCsv(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

function stringifyRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]),
    ),
  )
}

function parseSheet(sheet: XLSX.WorkSheet): ParsedTable {
  const rows = stringifyRows(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }),
  )
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : []
  return { headers, rows }
}

export async function parseTableFile(file: File): Promise<ParsedTable> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'csv') {
    const text = normalizeCsv(await file.text())
    const workbook = XLSX.read(text, { type: 'string' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { headers: [], rows: [] }
    const sheet = workbook.Sheets[sheetName]
    return parseSheet(sheet)
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }
  const sheet = workbook.Sheets[sheetName]
  return parseSheet(sheet)
}

export function inferSourceType(fileName: string): 'excel' | 'csv' | 'other' {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'xlsx' || extension === 'xls') return 'excel'
  if (extension === 'csv') return 'csv'
  return 'other'
}
