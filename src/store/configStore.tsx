import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { districts } from '../data/seed/districts'
import { regionalOffices } from '../data/seed/regionalOffices'
import { workplaces } from '../data/seed/workplaces'
import type {
  DistrictWorkplaceAssignments,
  WorkplaceRegionalAssignments,
} from '../domain/types/assignment'
import { buildDefaultDistrictAssignments, loadJson, saveJson } from '../utils/storage'

const CONFIG_STORAGE_KEY = 'map-graph-config-v3'
const MAX_HISTORY = 50

export interface ConfigState {
  districtWorkplaceAssignments: DistrictWorkplaceAssignments
  workplaceRegionalAssignments: WorkplaceRegionalAssignments
}

interface HistoryState {
  past: ConfigState[]
  present: ConfigState
  future: ConfigState[]
}

export type ConfigAction =
  | { type: 'set-district-workplace'; districtId: string; workplaceId: string | null }
  | { type: 'set-workplace-regional'; workplaceId: string; regionalOfficeId: string | null }
  | { type: 'reset-default-assignments' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }

function cloneConfig(state: ConfigState): ConfigState {
  return {
    districtWorkplaceAssignments: { ...state.districtWorkplaceAssignments },
    workplaceRegionalAssignments: { ...state.workplaceRegionalAssignments },
  }
}

function loadInitialConfig(): ConfigState {
  const stored = loadJson<ConfigState | null>(CONFIG_STORAGE_KEY, null)
  if (stored) return stored

  return {
    districtWorkplaceAssignments: buildDefaultDistrictAssignments(districts, workplaces),
    workplaceRegionalAssignments: {},
  }
}

function applyConfigAction(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'set-district-workplace': {
      const next = { ...state.districtWorkplaceAssignments }
      if (action.workplaceId) next[action.districtId] = action.workplaceId
      else delete next[action.districtId]
      return { ...state, districtWorkplaceAssignments: next }
    }
    case 'set-workplace-regional': {
      const next = { ...state.workplaceRegionalAssignments }
      if (action.regionalOfficeId) next[action.workplaceId] = action.regionalOfficeId
      else delete next[action.workplaceId]
      return { ...state, workplaceRegionalAssignments: next }
    }
    case 'reset-default-assignments':
      return {
        ...state,
        districtWorkplaceAssignments: buildDefaultDistrictAssignments(districts, workplaces),
      }
    default:
      return state
  }
}

function historyReducer(state: HistoryState, action: ConfigAction): HistoryState {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]!
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [cloneConfig(state.present), ...state.future],
    }
  }

  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const next = state.future[0]!
    return {
      past: [...state.past, cloneConfig(state.present)],
      present: next,
      future: state.future.slice(1),
    }
  }

  if (action.type === 'reset') {
    const initial = {
      districtWorkplaceAssignments: buildDefaultDistrictAssignments(districts, workplaces),
      workplaceRegionalAssignments: {},
    }
    return {
      past: [...state.past, cloneConfig(state.present)].slice(-MAX_HISTORY),
      present: initial,
      future: [],
    }
  }

  const nextPresent = applyConfigAction(state.present, action)
  if (nextPresent === state.present) return state

  return {
    past: [...state.past, cloneConfig(state.present)].slice(-MAX_HISTORY),
    present: nextPresent,
    future: [],
  }
}

const ConfigStateContext = createContext<ConfigState | null>(null)
const HistoryMetaContext = createContext<{ canUndo: boolean; canRedo: boolean } | null>(null)
const ConfigDispatchContext = createContext<Dispatch<ConfigAction> | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: loadInitialConfig(),
    future: [],
  }))

  useEffect(() => {
    saveJson(CONFIG_STORAGE_KEY, history.present)
  }, [history.present])

  return (
    <ConfigStateContext.Provider value={history.present}>
      <HistoryMetaContext.Provider
        value={{ canUndo: history.past.length > 0, canRedo: history.future.length > 0 }}
      >
        <ConfigDispatchContext.Provider value={dispatch}>{children}</ConfigDispatchContext.Provider>
      </HistoryMetaContext.Provider>
    </ConfigStateContext.Provider>
  )
}

export function useConfigState(): ConfigState {
  const context = useContext(ConfigStateContext)
  if (!context) throw new Error('useConfigState must be used within ConfigProvider')
  return context
}

export function useConfigDispatch(): Dispatch<ConfigAction> {
  const context = useContext(ConfigDispatchContext)
  if (!context) throw new Error('useConfigDispatch must be used within ConfigProvider')
  return context
}

export function useConfigHistory() {
  const context = useContext(HistoryMetaContext)
  if (!context) throw new Error('useConfigHistory must be used within ConfigProvider')
  return context
}

export function useConfigData() {
  return {
    districts,
    workplaces,
    regionalOffices,
  }
}
