import type { DatasetColumn } from '../types/datasetColumn'
import type { DatasetRecord } from '../types/datasetRecord'

export interface DatasetImportSnapshot {
  capturedAt: string
  name: string
  columns: DatasetColumn[]
  records: DatasetRecord[]
}

export function cloneDatasetRecords(records: DatasetRecord[]): DatasetRecord[] {
  return records.map((record) => ({
    ...record,
    values: { ...record.values },
  }))
}

export function cloneDatasetColumns(columns: DatasetColumn[]): DatasetColumn[] {
  return columns.map((column) => ({ ...column }))
}

export function createImportSnapshot(
  name: string,
  columns: DatasetColumn[],
  records: DatasetRecord[],
): DatasetImportSnapshot {
  return {
    capturedAt: new Date().toISOString(),
    name,
    columns: cloneDatasetColumns(columns),
    records: cloneDatasetRecords(records),
  }
}
