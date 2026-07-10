import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import { migrateDatasetStatus, resolveReadyStatus } from '../domain/dataset/datasetValidation'
import type { Dataset, DatasetStatus } from '../domain/types/dataset'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import {
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

type DatasetAction =
  | { type: 'add-dataset'; dataset: Dataset; records: DatasetRecord[] }
  | { type: 'update-record-match'; datasetId: string; recordId: string; workplaceId: string }
  | { type: 'update-dataset-status'; datasetId: string; status: DatasetStatus }
  | { type: 'remove-dataset'; datasetId: string }

function migrateState(stored: DatasetState): DatasetState {
  return {
    ...stored,
    datasets: stored.datasets.map((dataset) => ({
      ...dataset,
      status: migrateDatasetStatus(dataset.status),
    })),
  }
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

function datasetReducer(state: DatasetState, action: DatasetAction): DatasetState {
  switch (action.type) {
    case 'add-dataset':
      return {
        datasets: [action.dataset, ...state.datasets.filter((item) => item.id !== action.dataset.id)],
        recordsByDataset: {
          ...state.recordsByDataset,
          [action.dataset.id]: action.records,
        },
      }
    case 'update-record-match': {
      const records = state.recordsByDataset[action.datasetId] ?? []
      const updatedRecords = records.map((record) =>
        record.id === action.recordId
          ? { ...record, workplaceId: action.workplaceId, matchStatus: 'manual' as const }
          : record,
      )
      const matchedCount = updatedRecords.filter((record) => record.workplaceId).length
      const datasets = state.datasets.map((dataset) => {
        if (dataset.id !== action.datasetId) return dataset
        const next = {
          ...dataset,
          matchedCount,
          unmatchedCount: updatedRecords.length - matchedCount,
        }
        return {
          ...next,
          status: computeDatasetStatus(next, updatedRecords),
        }
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
