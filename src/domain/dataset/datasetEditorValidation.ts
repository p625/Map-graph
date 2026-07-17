import type { DatasetColumn } from '../types/datasetColumn'
import type { DatasetRecord } from '../types/datasetRecord'
import type { Workplace } from '../types/workplace'
import type { ColumnType } from '../types/datasetColumn'

export type DatasetEditorIssueSeverity = 'error' | 'warning'

export interface DatasetEditorIssue {
  severity: DatasetEditorIssueSeverity
  code: string
  message: string
  recordId?: string
  columnKey?: string
}

export interface DatasetEditorValidationResult {
  issues: DatasetEditorIssue[]
  blocking: boolean
}

export function parseEditedCellValue(
  raw: string,
  type: ColumnType,
): { value: unknown; error?: string } {
  if (raw.trim() === '') return { value: null }

  if (type === 'text') {
    return { value: raw }
  }

  const normalized = raw.trim().replace('%', '').replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return { value: null, error: 'Neplatné číslo' }
  }
  return { value: parsed }
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  return String(value)
}

export function validateDatasetEditorState(input: {
  name: string
  columns: DatasetColumn[]
  records: DatasetRecord[]
  workplaces: Workplace[]
}): DatasetEditorValidationResult {
  const issues: DatasetEditorIssue[] = []
  const workplaceIds = new Set(input.workplaces.map((wp) => wp.id))
  const seenWorkplaces = new Set<string>()

  if (!input.name.trim()) {
    issues.push({
      severity: 'error',
      code: 'empty_name',
      message: 'Název datasetu je povinný.',
    })
  }

  if (input.columns.length === 0) {
    issues.push({
      severity: 'error',
      code: 'no_columns',
      message: 'Dataset musí mít alespoň jeden datový sloupec.',
    })
  }

  if (input.records.length === 0) {
    issues.push({
      severity: 'error',
      code: 'no_rows',
      message: 'Dataset musí obsahovat alespoň jeden řádek.',
    })
  }

  for (const record of input.records) {
    if (!record.workplaceId) {
      issues.push({
        severity: 'error',
        code: 'missing_workplace',
        message: 'Řádek nemá přiřazené pracoviště.',
        recordId: record.id,
      })
      continue
    }

    if (!workplaceIds.has(record.workplaceId)) {
      issues.push({
        severity: 'error',
        code: 'unknown_workplace',
        message: `Neznámé pracoviště: ${record.workplaceId}`,
        recordId: record.id,
      })
    }

    if (seenWorkplaces.has(record.workplaceId)) {
      issues.push({
        severity: 'warning',
        code: 'duplicate_workplace',
        message: 'Více řádků pro stejné pracoviště.',
        recordId: record.id,
      })
    }
    seenWorkplaces.add(record.workplaceId)

    for (const column of input.columns) {
      const value = record.values[column.key]
      if (value === null || value === undefined || value === '') continue

      if (column.type === 'number' || column.type === 'percent') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          issues.push({
            severity: 'error',
            code: 'invalid_number',
            message: `Sloupec „${column.name}“ vyžaduje číslo.`,
            recordId: record.id,
            columnKey: column.key,
          })
        }
      }
    }
  }

  const blocking = issues.some((issue) => issue.severity === 'error')
  return { issues, blocking }
}
