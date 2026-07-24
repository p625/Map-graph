import { WORKSPACE_MODULE_KEYS } from '../workspace/workspaceBackup'
import { estimateJsonBytes } from '../../utils/storage'
import type { Dataset } from '../types/dataset'
import type { DatasetRecord } from '../types/datasetRecord'
import { PERSISTENCE_MODE } from './persistenceStatus'

export const DATASET_STORAGE_KEY = 'map-graph-datasets-v2'

export interface StorageModuleSize {
  key: string
  label: string
  bytes: number
}

export interface StorageDiagnostics {
  mode: typeof PERSISTENCE_MODE
  datasetCount: number
  totalRecordCount: number
  approximateBytes: number
  approximateMegabytes: number
  lastDatasetUpdateAt: string | null
  crossDeviceSync: false
  moduleSizes: StorageModuleSize[]
}

const MODULE_LABELS: Record<string, string> = {
  [WORKSPACE_MODULE_KEYS.organization]: 'Organizace',
  [WORKSPACE_MODULE_KEYS.config]: 'Barvy a přiřazení',
  [WORKSPACE_MODULE_KEYS.datasets]: 'Datasety',
  [WORKSPACE_MODULE_KEYS.map]: 'Mapa',
  [WORKSPACE_MODULE_KEYS.workplaceLabelOverrides]: 'Popisky pracovišť',
  [WORKSPACE_MODULE_KEYS.regionLabelOverrides]: 'Popisky regionů',
  [WORKSPACE_MODULE_KEYS.supervisionPlan]: 'Plán supervizí',
  [WORKSPACE_MODULE_KEYS.customColorThemes]: 'Barevná témata',
  [WORKSPACE_MODULE_KEYS.templates]: 'Šablony',
  [WORKSPACE_MODULE_KEYS.exportPresets]: 'Exportní presety',
}

export function readRawStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function readStoredModuleSize(key: string): number {
  const raw = readRawStorageItem(key)
  if (!raw) return 0
  return new TextEncoder().encode(raw).length
}

export interface DatasetStateSnapshot {
  datasets: Dataset[]
  recordsByDataset: Record<string, DatasetRecord[]>
}

export function buildStorageDiagnostics(
  datasetState: DatasetStateSnapshot,
  moduleKeys: Record<string, string> = WORKSPACE_MODULE_KEYS,
): StorageDiagnostics {
  const moduleSizes = Object.values(moduleKeys).map((key) => ({
    key,
    label: MODULE_LABELS[key] ?? key,
    bytes: readStoredModuleSize(key),
  }))

  const approximateBytes = moduleSizes.reduce((sum, item) => sum + item.bytes, 0)
  const totalRecordCount = Object.values(datasetState.recordsByDataset).reduce(
    (sum, records) => sum + records.length,
    0,
  )

  const lastDatasetUpdateAt =
    datasetState.datasets
      .map((dataset) => dataset.updatedAt ?? dataset.importedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return {
    mode: PERSISTENCE_MODE,
    datasetCount: datasetState.datasets.length,
    totalRecordCount,
    approximateBytes,
    approximateMegabytes: approximateBytes / (1024 * 1024),
    lastDatasetUpdateAt,
    crossDeviceSync: false,
    moduleSizes,
  }
}

export function formatStorageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function estimateDatasetStateBytes(state: DatasetStateSnapshot): number {
  return estimateJsonBytes(state)
}

export const DATASET_QUOTA_ERROR_MESSAGE =
  'Dataset se nepodařilo uložit do tohoto prohlížeče. Úložiště je pravděpodobně plné. Exportujte zálohu nebo odstraňte nepotřebná data.'
