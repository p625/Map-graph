import type { Dataset } from '../types/dataset'
import type { DatasetColumn } from '../types/datasetColumn'

export type HealthSeverity = 'error' | 'warning' | 'info'

export interface DatasetHealthIssue {
  severity: HealthSeverity
  code: string
  message: string
  count?: number
}

export interface DatasetHealth {
  datasetId: string
  overallScore: number
  importOk: boolean
  rowsTotal: number
  rowsMatched: number
  rowsUnmatched: number
  numericColumns: number
  textColumns: number
  percentColumns: number
  issues: DatasetHealthIssue[]
  canProceedToMap: boolean
}

export function computeDatasetHealth(
  dataset: Pick<
    Dataset,
    'id' | 'name' | 'recordCount' | 'matchedCount' | 'unmatchedCount' | 'columns'
  >,
): DatasetHealth {
  const issues: DatasetHealthIssue[] = []
  const rowsTotal = dataset.recordCount
  const rowsMatched = dataset.matchedCount
  const rowsUnmatched = dataset.unmatchedCount

  const numericColumns = dataset.columns.filter((c) => c.type === 'number').length
  const textColumns = dataset.columns.filter((c) => c.type === 'text').length
  const percentColumns = dataset.columns.filter((c) => c.type === 'percent').length
  const dataColumns = dataset.columns.length

  if (rowsTotal === 0) {
    issues.push({
      severity: 'error',
      code: 'no_rows',
      message: 'Dataset neobsahuje žádné řádky.',
    })
  }

  if (rowsUnmatched > 0) {
    issues.push({
      severity: 'error',
      code: 'unmatched_rows',
      message: `${rowsUnmatched} řádků není spárováno na pracoviště.`,
      count: rowsUnmatched,
    })
  }

  if (dataColumns === 0) {
    issues.push({
      severity: 'error',
      code: 'no_data_columns',
      message: 'Dataset nemá žádné datové sloupce.',
    })
  }

  if (!dataset.name.trim()) {
    issues.push({
      severity: 'warning',
      code: 'empty_name',
      message: 'Dataset nemá název.',
    })
  }

  let score = 100
  if (rowsTotal > 0) {
    score -= (rowsUnmatched / rowsTotal) * 40
  } else {
    score -= 40
  }
  if (dataColumns === 0) score -= 30
  if (!dataset.name.trim()) score -= 10

  const hasErrors = issues.some((i) => i.severity === 'error')
  const overallScore = Math.max(0, Math.round(score))

  return {
    datasetId: dataset.id,
    overallScore,
    importOk: rowsTotal > 0,
    rowsTotal,
    rowsMatched,
    rowsUnmatched,
    numericColumns,
    textColumns,
    percentColumns,
    issues,
    canProceedToMap: !hasErrors && rowsTotal > 0 && dataColumns > 0,
  }
}

export function summarizeColumns(columns: DatasetColumn[]): string {
  const parts: string[] = []
  const n = columns.filter((c) => c.type === 'number').length
  const t = columns.filter((c) => c.type === 'text').length
  const p = columns.filter((c) => c.type === 'percent').length
  if (n) parts.push(`${n} číselné`)
  if (p) parts.push(`${p} procenta`)
  if (t) parts.push(`${t} textové`)
  return parts.join(', ') || 'žádné'
}
