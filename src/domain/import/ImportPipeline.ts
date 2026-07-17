import type { Dataset } from '../types/dataset'
import type { DatasetColumn } from '../types/datasetColumn'
import type { DatasetRecord } from '../types/datasetRecord'
import type { Workplace } from '../types/workplace'
import { resolveStatusFromPreview } from '../dataset/datasetValidation'
import { createImportSnapshot } from '../dataset/datasetSnapshot'
import {
  detectColumnTypes,
  toColumnKey,
  uniqueColumnKey,
  type ParsedTable,
} from './columnTypeDetector'
import { detectWorkplaceColumn, excludeWorkplaceColumn } from './workplaceColumnDetector'
import { matchWorkplaceLabel } from './workplaceMatcher'

export interface ImportPreview {
  workplaceColumn: string | null
  columns: DatasetColumn[]
  records: DatasetRecord[]
  matchedCount: number
  unmatchedCount: number
}

function parseNumericValue(raw: string, type: DatasetColumn['type']): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (type === 'text') return trimmed
  const normalized = trimmed.replace('%', '').replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : trimmed
}

export function buildImportPreview(
  table: ParsedTable,
  workplaces: Workplace[],
  datasetId: string,
  workplaceColumn?: string | null,
): ImportPreview {
  const selectedWorkplaceColumn =
    workplaceColumn ?? detectWorkplaceColumn(table.headers, table.rows, workplaces)
  const dataHeaders = excludeWorkplaceColumn(table, selectedWorkplaceColumn)
  const detectedTypes = detectColumnTypes(dataHeaders, table.rows)
  const usedKeys = new Set<string>()

  const columns: DatasetColumn[] = dataHeaders.map((header, index) => {
    const key = uniqueColumnKey(toColumnKey(header) || `column_${index + 1}`, usedKeys)
    return {
      id: `col-${index}`,
      key,
      name: header,
      type: detectedTypes[header] ?? 'text',
      nullable: true,
    }
  })

  const records: DatasetRecord[] = table.rows
    .filter((row) => Object.values(row).some((value) => String(value).trim() !== ''))
    .map((row, index) => {
      const rawLabel = selectedWorkplaceColumn ? row[selectedWorkplaceColumn] ?? '' : ''
      const match = matchWorkplaceLabel(rawLabel, workplaces)
      const values = Object.fromEntries(
        columns.map((column) => [
          column.key,
          parseNumericValue(row[column.name] ?? '', column.type),
        ]),
      )

      return {
        id: `${datasetId}-record-${index + 1}`,
        datasetId,
        workplaceId: match.workplaceId,
        matchStatus: match.matchStatus,
        rawLabel: rawLabel || undefined,
        values,
      }
    })

  const matchedCount = records.filter((record) => record.workplaceId).length

  return {
    workplaceColumn: selectedWorkplaceColumn,
    columns,
    records,
    matchedCount,
    unmatchedCount: records.length - matchedCount,
  }
}

export function createDatasetFromPreview(
  preview: ImportPreview,
  params: {
    id: string
    name: string
    source: Dataset['source']
    sourceFileName?: string
  },
): Dataset {
  const importedAt = new Date().toISOString()
  return {
    id: params.id,
    name: params.name,
    source: params.source,
    sourceFileName: params.sourceFileName,
    importedAt,
    updatedAt: importedAt,
    revision: 1,
    importSnapshot: createImportSnapshot(params.name, preview.columns, preview.records),
    status: resolveStatusFromPreview(preview),
    columns: preview.columns,
    recordCount: preview.records.length,
    matchedCount: preview.matchedCount,
    unmatchedCount: preview.unmatchedCount,
  }
}
