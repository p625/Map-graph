import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { migrateDatasetStatus, resolveReadyStatus } from '../domain/dataset/datasetValidation'
import type { Dataset, DatasetStatus } from '../domain/types/dataset'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import { loadJson, saveJson } from '../utils/storage'

const DATASET_STORAGE_KEY = 'map-graph-datasets-v2'

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
  const v2 = loadJson<DatasetState | null>(DATASET_STORAGE_KEY, null)
  if (v2) return migrateState(v2)

  const v1 = loadJson<DatasetState | null>('map-graph-datasets-v1', null)
  if (v1) return migrateState(v1)

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

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(datasetReducer, undefined, loadInitialDatasetState)

  useEffect(() => {
    saveJson(DATASET_STORAGE_KEY, state)
  }, [state])

  return (
    <DatasetStateContext.Provider value={state}>
      <DatasetDispatchContext.Provider value={dispatch}>{children}</DatasetDispatchContext.Provider>
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
