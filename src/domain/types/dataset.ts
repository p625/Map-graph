import type { DatasetColumn } from './datasetColumn'
import type { DatasetImportSnapshot } from '../dataset/datasetSnapshot'

export type DataSourceType = 'manual' | 'excel' | 'csv' | 'lpis' | 'other'

export type DatasetStatus =
  | 'draft'
  | 'imported'
  | 'matched'
  | 'validated'
  | 'ready'

export interface Dataset {
  id: string
  name: string
  source: DataSourceType
  sourceFileName?: string
  importedAt: string
  updatedAt?: string
  revision?: number
  importSnapshot?: DatasetImportSnapshot
  status: DatasetStatus
  columns: DatasetColumn[]
  recordCount: number
  matchedCount: number
  unmatchedCount: number
}
