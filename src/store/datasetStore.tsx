import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import {
  cloneDatasetColumns,
  cloneDatasetRecords,
  createImportSnapshot,
} from '../domain/dataset/datasetSnapshot'
import { migrateDatasetStatus, resolveReadyStatus } from '../domain/dataset/datasetValidation'
import type { Dataset, DatasetStatus } from '../domain/types/dataset'
import type { DatasetColumn } from '../domain/types/datasetColumn'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import {
  createId,
  estimateJsonBytes,
  isDatasetStateValid,
  loadJson,
  LOCAL_STORAGE_SOFT_LIMIT_BYTES,
  saveJson,
} from '../utils/storage'
import { useNotifications } from './notificationStore'

const DATASET_STORAGE_KEY = 'map-graph-datasets-v2'
const DATASET_STORAGE_KEY_V1 = 'map-graph-datasets-v1'

interface DatasetState {
  datasets: Dataset[]
  recordsByDataset: Record<string, DatasetRecord[]>
}

export interface SaveDatasetEditsPayload {
  datasetId: string
  name: string
  columns: DatasetColumn[]
  records: DatasetRecord[]
}

type DatasetAction =
  | { type: 'add-dataset'; dataset: Dataset; records: DatasetRecord[] }
  | { type: 'update-record-match'; datasetId: string; recordId: string; workplaceId: string }
  | { type: 'update-dataset-status'; datasetId: string; status: DatasetStatus }
  | { type: 'save-dataset-edits'; payload: SaveDatasetEditsPayload }
  | { type: 'restore-dataset-import'; datasetId: string }
  | { type: 'duplicate-dataset'; datasetId: string }
  | { type: 'remove-dataset'; datasetId: string }

function migrateDataset(dataset: Dataset, records: DatasetRecord[]): Dataset {
  const importedAt = dataset.importedAt ?? new Date().toISOString()
  const updatedAt = dataset.updatedAt ?? importedAt
  const revision = typeof dataset.revision === 'number' ? dataset.revision : 1
  const importSnapshot =
    dataset.importSnapshot ??
    createImportSnapshot(dataset.name, dataset.columns, cloneDatasetRecords(records))

  return {
    ...dataset,
    importedAt,
    updatedAt,
    revision,
    importSnapshot,
    status: migrateDatasetStatus(dataset.status),
  }
}

function migrateState(stored: DatasetState): DatasetState {
  const recordsByDataset = { ...stored.recordsByDataset }
  const datasets = stored.datasets.map((dataset) => {
    const records = recordsByDataset[dataset.id] ?? []
    return migrateDataset(dataset, records)
  })
  return { datasets, recordsByDataset }
}

function loadInitialDatasetState(): DatasetState {
  const v2 = loadJson<unknown>(DATASET_STORAGE_KEY, null)
  if (isDatasetStateValid(v2) && v2.datasets.length > 0) {
    return migrateState(v2)
  }

  const v1 = loadJson<unknown>(DATASET_STORAGE_KEY_V1, null)
  if (isDatasetStateValid(v1) && v1.datasets.length > 0) {
    const migrated = migrateState(v1)
    saveJson(DATASET_STORAGE_KEY, migrated)
    return migrated
  }

  if (isDatasetStateValid(v2)) {
    return migrateState(v2)
  }

  return { datasets: [], recordsByDataset: {} }
}

function computeDatasetStatus(
  dataset: Dataset,
  records: DatasetRecord[],
): DatasetStatus {
  const matchedCount = records.filter((r) => r.workplaceId).length
  return resolveReadyStatus(matchedCount, records.length, dataset.columns.length)
}

function recomputeDataset(
  dataset: Dataset,
  records: DatasetRecord[],
  patch: Partial<Dataset> = {},
): Dataset {
  const matchedCount = records.filter((record) => record.workplaceId).length
  const next = {
    ...dataset,
    ...patch,
    recordCount: records.length,
    matchedCount,
    unmatchedCount: records.length - matchedCount,
  }
  return {
    ...next,
    status: computeDatasetStatus(next, records),
  }
}

function datasetReducer(state: DatasetState, action: DatasetAction): DatasetState {
  switch (action.type) {
    case 'add-dataset': {
      const dataset = migrateDataset(action.dataset, action.records)
      return {
        datasets: [dataset, ...state.datasets.filter((item) => item.id !== dataset.id)],
        recordsByDataset: {
          ...state.recordsByDataset,
          [dataset.id]: cloneDatasetRecords(action.records),
        },
      }
    }
    case 'update-record-match': {
      const records = state.recordsByDataset[action.datasetId] ?? []
      const updatedRecords = records.map((record) =>
        record.id === action.recordId
          ? { ...record, workplaceId: action.workplaceId, matchStatus: 'manual' as const }
          : record,
      )
      const datasets = state.datasets.map((dataset) => {
        if (dataset.id !== action.datasetId) return dataset
        return recomputeDataset(dataset, updatedRecords, {
          updatedAt: new Date().toISOString(),
        })
      })
      return {
        datasets,
        recordsByDataset: {
          ...state.recordsByDataset,
          [action.datasetId]: updatedRecords,
        },
      }
    }
    case 'update-dataset-status':
      return {
        ...state,
        datasets: state.datasets.map((dataset) =>
          dataset.id === action.datasetId ? { ...dataset, status: action.status } : dataset,
        ),
      }
    case 'save-dataset-edits': {
      const { datasetId, name, columns, records } = action.payload
      const existing = state.datasets.find((item) => item.id === datasetId)
      if (!existing) return state

      const normalizedRecords = cloneDatasetRecords(records).map((record) => ({
        ...record,
        datasetId,
        matchStatus: record.workplaceId ? ('manual' as const) : ('unmatched' as const),
      }))

      const nextDataset = recomputeDataset(
        {
          ...existing,
          name,
          columns: cloneDatasetColumns(columns),
          revision: (existing.revision ?? 1) + 1,
          updatedAt: new Date().toISOString(),
        },
        normalizedRecords,
      )

      return {
        datasets: state.datasets.map((dataset) =>
          dataset.id === datasetId ? nextDataset : dataset,
        ),
        recordsByDataset: {
          ...state.recordsByDataset,
          [datasetId]: normalizedRecords,
        },
      }
    }
    case 'restore-dataset-import': {
      const existing = state.datasets.find((item) => item.id === action.datasetId)
      if (!existing?.importSnapshot) return state

      const snapshot = existing.importSnapshot
      const restoredRecords = cloneDatasetRecords(snapshot.records).map((record) => ({
        ...record,
        datasetId: action.datasetId,
      }))

      const nextDataset = recomputeDataset(
        {
          ...existing,
          name: snapshot.name,
          columns: cloneDatasetColumns(snapshot.columns),
          revision: (existing.revision ?? 1) + 1,
          updatedAt: new Date().toISOString(),
        },
        restoredRecords,
      )

      return {
        datasets: state.datasets.map((dataset) =>
          dataset.id === action.datasetId ? nextDataset : dataset,
        ),
        recordsByDataset: {
          ...state.recordsByDataset,
          [action.datasetId]: restoredRecords,
        },
      }
    }
    case 'duplicate-dataset': {
      const existing = state.datasets.find((item) => item.id === action.datasetId)
      if (!existing) return state
      const sourceRecords = state.recordsByDataset[action.datasetId] ?? []
      const newId = createId('dataset')
      const duplicatedRecords = cloneDatasetRecords(sourceRecords).map((record, index) => ({
        ...record,
        id: `${newId}-record-${index + 1}`,
        datasetId: newId,
      }))
      const now = new Date().toISOString()
      const duplicate: Dataset = {
        ...existing,
        id: newId,
        name: `${existing.name} (kopie)`,
        importedAt: now,
        updatedAt: now,
        revision: 1,
        importSnapshot: createImportSnapshot(
          `${existing.name} (kopie)`,
          existing.columns,
          duplicatedRecords,
        ),
      }
      return {
        datasets: [duplicate, ...state.datasets],
        recordsByDataset: {
          ...state.recordsByDataset,
          [newId]: duplicatedRecords,
        },
      }
    }
    case 'remove-dataset': {
      const recordsByDataset = { ...state.recordsByDataset }
      delete recordsByDataset[action.datasetId]
      return {
        datasets: state.datasets.filter((dataset) => dataset.id !== action.datasetId),
        recordsByDataset,
      }
    }
    default:
      return state
  }
}

const DatasetStateContext = createContext<DatasetState | null>(null)
const DatasetDispatchContext = createContext<Dispatch<DatasetAction> | null>(null)

function DatasetPersistenceBridge({ state }: { state: DatasetState }) {
  const { notify } = useNotifications()
  const warnedRef = useRef(false)

  useEffect(() => {
    const bytes = estimateJsonBytes(state)
    if (bytes > LOCAL_STORAGE_SOFT_LIMIT_BYTES && !warnedRef.current) {
      warnedRef.current = true
      notify({
        type: 'warning',
        title: 'Velký objem dat',
        message: `Datasety zabírají cca ${(bytes / 1_000_000).toFixed(1)} MB v localStorage. Uložení může selhat.`,
      })
    }

    const result = saveJson(DATASET_STORAGE_KEY, state)
    if (!result.ok && result.error === 'quota') {
      notify({
        type: 'error',
        title: 'Uložení datasetů selhalo',
        message: 'localStorage je plné. Smažte starší datasety nebo zmenšete import.',
      })
    }
  }, [state, notify])

  return null
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(datasetReducer, undefined, loadInitialDatasetState)

  return (
    <DatasetStateContext.Provider value={state}>
      <DatasetDispatchContext.Provider value={dispatch}>
        <DatasetPersistenceBridge state={state} />
        {children}
      </DatasetDispatchContext.Provider>
    </DatasetStateContext.Provider>
  )
}

export function useDatasetState(): DatasetState {
  const context = useContext(DatasetStateContext)
  if (!context) throw new Error('useDatasetState must be used within DatasetProvider')
  return context
}

export function useDatasetDispatch(): Dispatch<DatasetAction> {
  const context = useContext(DatasetDispatchContext)
  if (!context) throw new Error('useDatasetDispatch must be used within DatasetProvider')
  return context
}

export function useActiveDataset(datasetId: string | null) {
  const { datasets, recordsByDataset } = useDatasetState()
  const dataset = datasets.find((item) => item.id === datasetId) ?? null
  const records = dataset ? recordsByDataset[dataset.id] ?? [] : []
  return { dataset, records }
}

export function useDatasetActions() {
  const dispatch = useDatasetDispatch()
  return {
    addDataset: (dataset: Dataset, records: DatasetRecord[]) =>
      dispatch({ type: 'add-dataset', dataset, records }),
    saveDatasetEdits: (payload: SaveDatasetEditsPayload) =>
      dispatch({ type: 'save-dataset-edits', payload }),
    restoreDatasetImport: (datasetId: string) =>
      dispatch({ type: 'restore-dataset-import', datasetId }),
    duplicateDataset: (datasetId: string) =>
      dispatch({ type: 'duplicate-dataset', datasetId }),
    removeDataset: (datasetId: string) => dispatch({ type: 'remove-dataset', datasetId }),
  }
}
