import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { districts } from '../data/seed/districts'
import { workplaces } from '../data/seed/workplaces'
import { sanitizeMapColor } from '../domain/color/mapColorValidation'
import type {
  DistrictWorkplaceAssignments,
  WorkplaceRegionalAssignments,
} from '../domain/types'
import {
  snapshotToRegionalOffices,
  snapshotToWorkplaces,
  useOrganizationState,
} from './organizationStore'
import type { OrganizationSnapshot } from '../domain/organization/types'
import { isOrganizationSynced } from '../domain/organization/organizationState'
import { snapshotToConfigAssignments } from '../domain/organization/organizationSync'
import { buildDefaultDistrictAssignments, loadJson, saveJson } from '../utils/storage'
import { useNotifications } from './notificationStore'

const CONFIG_STORAGE_KEY = 'map-graph-config-v4'
const ORG_STORAGE_KEY = 'map-graph-org-v1'
const MAX_HISTORY = 50

export interface ConfigState {
  districtWorkplaceAssignments: DistrictWorkplaceAssignments
  workplaceRegionalAssignments: WorkplaceRegionalAssignments
  districtDisplayColors: Record<string, string>
  workplaceDisplayColors: Record<string, string>
  regionDisplayColors: Record<string, string>
}

interface HistoryState {
  past: ConfigState[]
  present: ConfigState
  future: ConfigState[]
}

export type ConfigAction =
  | { type: 'set-district-workplace'; districtId: string; workplaceId: string | null }
  | { type: 'set-workplace-regional'; workplaceId: string; regionalOfficeId: string | null }
  | { type: 'set-district-color'; districtId: string; color: string }
  | { type: 'reset-district-color'; districtId: string }
  | { type: 'reset-all-district-colors' }
  | { type: 'set-workplace-color'; workplaceId: string; color: string }
  | { type: 'reset-workplace-color'; workplaceId: string }
  | { type: 'reset-all-workplace-colors' }
  | { type: 'set-region-color'; regionId: string; color: string }
  | { type: 'reset-region-color'; regionId: string }
  | { type: 'reset-all-region-colors' }
  | {
      type: 'apply-organization-sync'
      districtWorkplaceAssignments: DistrictWorkplaceAssignments
      workplaceRegionalAssignments: WorkplaceRegionalAssignments
    }
  | {
      type: 'sync-derived-organization-assignments'
      districtWorkplaceAssignments: DistrictWorkplaceAssignments
      workplaceRegionalAssignments: WorkplaceRegionalAssignments
    }
  | {
      type: 'sync-derived-regional-assignments'
      workplaceRegionalAssignments: WorkplaceRegionalAssignments
    }
  | { type: 'reset-default-assignments' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }

function cloneConfig(state: ConfigState): ConfigState {
  return {
    districtWorkplaceAssignments: { ...state.districtWorkplaceAssignments },
    workplaceRegionalAssignments: { ...state.workplaceRegionalAssignments },
    districtDisplayColors: { ...state.districtDisplayColors },
    workplaceDisplayColors: { ...state.workplaceDisplayColors },
    regionDisplayColors: { ...state.regionDisplayColors },
  }
}

function normalizeConfigState(stored: Partial<ConfigState> | null): ConfigState {
  if (!stored) {
    return {
      districtWorkplaceAssignments: buildDefaultDistrictAssignments(districts, workplaces),
      workplaceRegionalAssignments: {},
      districtDisplayColors: {},
      workplaceDisplayColors: {},
      regionDisplayColors: {},
    }
  }
  return {
    districtWorkplaceAssignments:
      stored.districtWorkplaceAssignments ??
      buildDefaultDistrictAssignments(districts, workplaces),
    workplaceRegionalAssignments: stored.workplaceRegionalAssignments ?? {},
    districtDisplayColors: stored.districtDisplayColors ?? {},
    workplaceDisplayColors: stored.workplaceDisplayColors ?? {},
    regionDisplayColors: stored.regionDisplayColors ?? {},
  }
}

function loadInitialConfig(): ConfigState {
  const stored = loadJson<Partial<ConfigState> | null>(CONFIG_STORAGE_KEY, null)
  const base = normalizeConfigState(stored)
  const orgSnapshot = loadJson<OrganizationSnapshot | null>(ORG_STORAGE_KEY, null)

  if (orgSnapshot && isOrganizationSynced(orgSnapshot)) {
    const fromOrg = snapshotToConfigAssignments(orgSnapshot)
    return {
      ...base,
      districtWorkplaceAssignments: fromOrg.districtWorkplaceAssignments,
      workplaceRegionalAssignments: fromOrg.workplaceRegionalAssignments,
    }
  }

  return base
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
    case 'set-district-color': {
      const next = { ...state.districtDisplayColors, [action.districtId]: action.color }
      return { ...state, districtDisplayColors: next }
    }
    case 'reset-district-color': {
      const next = { ...state.districtDisplayColors }
      delete next[action.districtId]
      return { ...state, districtDisplayColors: next }
    }
    case 'reset-all-district-colors':
      return { ...state, districtDisplayColors: {} }
    case 'set-workplace-color': {
      const color = sanitizeMapColor(action.color)
      if (!color) return state
      const next = { ...state.workplaceDisplayColors, [action.workplaceId]: color }
      return { ...state, workplaceDisplayColors: next }
    }
    case 'reset-workplace-color': {
      const next = { ...state.workplaceDisplayColors }
      delete next[action.workplaceId]
      return { ...state, workplaceDisplayColors: next }
    }
    case 'reset-all-workplace-colors':
      return { ...state, workplaceDisplayColors: {} }
    case 'set-region-color': {
      const color = sanitizeMapColor(action.color)
      if (!color) return state
      const next = { ...state.regionDisplayColors, [action.regionId]: color }
      return { ...state, regionDisplayColors: next }
    }
    case 'reset-region-color': {
      const next = { ...state.regionDisplayColors }
      delete next[action.regionId]
      return { ...state, regionDisplayColors: next }
    }
    case 'reset-all-region-colors':
      return { ...state, regionDisplayColors: {} }
    case 'reset-default-assignments':
      return {
        ...state,
        districtWorkplaceAssignments: buildDefaultDistrictAssignments(districts, workplaces),
      }
    case 'apply-organization-sync':
      return {
        districtWorkplaceAssignments: { ...action.districtWorkplaceAssignments },
        workplaceRegionalAssignments: { ...action.workplaceRegionalAssignments },
        districtDisplayColors: { ...state.districtDisplayColors },
        workplaceDisplayColors: { ...state.workplaceDisplayColors },
        regionDisplayColors: { ...state.regionDisplayColors },
      }
    case 'sync-derived-organization-assignments':
      return {
        ...state,
        districtWorkplaceAssignments: { ...action.districtWorkplaceAssignments },
        workplaceRegionalAssignments: { ...action.workplaceRegionalAssignments },
      }
    case 'sync-derived-regional-assignments':
      return {
        ...state,
        workplaceRegionalAssignments: { ...action.workplaceRegionalAssignments },
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
    const initial = normalizeConfigState(null)
    return {
      past: [...state.past, cloneConfig(state.present)].slice(-MAX_HISTORY),
      present: initial,
      future: [],
    }
  }

  if (action.type === 'sync-derived-regional-assignments') {
    const nextPresent = applyConfigAction(state.present, action)
    if (nextPresent === state.present) return state
    return { ...state, present: nextPresent }
  }

  if (action.type === 'sync-derived-organization-assignments') {
    const nextPresent = applyConfigAction(state.present, action)
    if (nextPresent === state.present) return state
    return { ...state, present: nextPresent }
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

function ConfigPersistenceBridge({ state }: { state: ConfigState }) {
  const { notify } = useNotifications()

  useEffect(() => {
    const result = saveJson(CONFIG_STORAGE_KEY, state)
    if (!result.ok) {
      notify({
        type: 'error',
        title: 'Uložení konfigurace selhalo',
        message:
          result.error === 'quota'
            ? 'Barvy a přiřazení se nepodařilo uložit — localStorage je plné.'
            : 'Konfigurace se nepodařila uložit.',
      })
    }
  }, [state, notify])

  return null
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: loadInitialConfig(),
    future: [],
  }))

  return (
    <ConfigStateContext.Provider value={history.present}>
      <HistoryMetaContext.Provider
        value={{ canUndo: history.past.length > 0, canRedo: history.future.length > 0 }}
      >
        <ConfigDispatchContext.Provider value={dispatch}>
          <ConfigPersistenceBridge state={history.present} />
          {children}
        </ConfigDispatchContext.Provider>
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
  const { snapshot } = useOrganizationState()
  return {
    districts,
    workplaces: snapshotToWorkplaces(snapshot),
    regionalOffices: snapshotToRegionalOffices(snapshot),
    organizationSnapshot: snapshot,
  }
}
