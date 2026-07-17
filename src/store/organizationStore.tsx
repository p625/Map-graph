import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { regionalOffices as seedRegionalOffices } from '../data/seed/regionalOffices'
import { workplaces as seedWorkplaces } from '../data/seed/workplaces'
import type { RegionalOffice } from '../domain/types/regionalOffice'
import type { Workplace } from '../domain/types/workplace'
import { seedOrganizationFromWorkplaces } from '../domain/organization/organizationSync'
import {
  isEmptyOrganizationSeed,
  isOrganizationSynced,
  normalizePersistedOrganization,
} from '../domain/organization/organizationState'
import { sanitizeMapColor } from '../domain/color/mapColorValidation'
import {
  validateWorkplaceLeaderChange,
  validateWorkplaceRegionChange,
} from '../domain/organization/assignmentValidation'
import type { OrganizationSnapshot } from '../domain/organization/types'
import { loadJson, saveJson } from '../utils/storage'
import { useNotifications } from './notificationStore'

const ORG_STORAGE_KEY = 'map-graph-org-v1'
const MAX_HISTORY = 50

export type OrganizationHydrationStatus = 'loading' | 'ready' | 'missing' | 'invalid'

interface HistoryState {
  past: OrganizationSnapshot[]
  present: OrganizationSnapshot
  future: OrganizationSnapshot[]
}

type OrganizationAction =
  | { type: 'set-snapshot'; snapshot: OrganizationSnapshot }
  | { type: 'set-leader-color'; leaderId: string; color: string }
  | { type: 'set-workplace-leader'; workplaceId: string; leaderId: string }
  | { type: 'set-workplace-region'; workplaceId: string; regionId: string }
  | {
      type: 'bulk-set-workplace-assignments'
      workplaceIds: string[]
      regionId?: string
      leaderId?: string
    }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }
  | { type: 'clear-persisted-organization' }

function cloneSnapshot(snapshot: OrganizationSnapshot): OrganizationSnapshot {
  return {
    ...snapshot,
    regions: snapshot.regions.map((item) => ({ ...item })),
    orgUnits: snapshot.orgUnits.map((item) => ({ ...item })),
    leaders: snapshot.leaders.map((item) => ({ ...item })),
    workplaces: snapshot.workplaces.map((item) => ({
      ...item,
      manualEdits: item.manualEdits ? { ...item.manualEdits } : undefined,
    })),
    districtAssignments: snapshot.districtAssignments.map((item) => ({ ...item })),
  }
}

function loadInitialSnapshot(): OrganizationSnapshot {
  const stored = loadJson<OrganizationSnapshot | null>(ORG_STORAGE_KEY, null)
  if (!stored || isEmptyOrganizationSeed(stored)) {
    return seedOrganizationFromWorkplaces()
  }
  return normalizePersistedOrganization(stored)
}

function resolveHydrationStatus(snapshot: OrganizationSnapshot): OrganizationHydrationStatus {
  const stored = loadJson<OrganizationSnapshot | null>(ORG_STORAGE_KEY, null)
  if (!stored || isEmptyOrganizationSeed(stored)) return 'missing'
  if (!isOrganizationSynced(snapshot)) return 'invalid'
  return 'ready'
}

function applyOrganizationAction(
  snapshot: OrganizationSnapshot,
  action: OrganizationAction,
): OrganizationSnapshot | null {
  switch (action.type) {
    case 'set-snapshot':
      return action.snapshot
    case 'set-leader-color': {
      const color = sanitizeMapColor(action.color)
      if (!color) return null
      return {
        ...snapshot,
        leaders: snapshot.leaders.map((leader) =>
          leader.id === action.leaderId ? { ...leader, color } : leader,
        ),
      }
    }
    case 'set-workplace-leader': {
      const error = validateWorkplaceLeaderChange(snapshot, action.workplaceId, action.leaderId)
      if (error) return null
      const leader = snapshot.leaders.find((item) => item.id === action.leaderId)!
      return {
        ...snapshot,
        workplaces: snapshot.workplaces.map((workplace) =>
          workplace.id === action.workplaceId
            ? {
                ...workplace,
                leaderId: leader.id,
                orgUnitId: leader.orgUnitId,
                manualEdits: { ...workplace.manualEdits, leaderId: true },
              }
            : workplace,
        ),
      }
    }
    case 'set-workplace-region': {
      const error = validateWorkplaceRegionChange(snapshot, action.workplaceId, action.regionId)
      if (error) return null
      return {
        ...snapshot,
        workplaces: snapshot.workplaces.map((workplace) =>
          workplace.id === action.workplaceId
            ? {
                ...workplace,
                regionId: action.regionId,
                manualEdits: { ...workplace.manualEdits, regionId: true },
              }
            : workplace,
        ),
      }
    }
    case 'bulk-set-workplace-assignments': {
      for (const workplaceId of action.workplaceIds) {
        if (action.regionId) {
          const error = validateWorkplaceRegionChange(snapshot, workplaceId, action.regionId)
          if (error) return null
        }
        if (action.leaderId) {
          const error = validateWorkplaceLeaderChange(snapshot, workplaceId, action.leaderId)
          if (error) return null
        }
      }

      const nextWorkplaces = snapshot.workplaces.map((workplace) => {
        if (!action.workplaceIds.includes(workplace.id)) return workplace
        let next = workplace
        if (action.regionId) {
          next = {
            ...next,
            regionId: action.regionId,
            manualEdits: { ...next.manualEdits, regionId: true },
          }
        }
        if (action.leaderId) {
          const leader = snapshot.leaders.find((item) => item.id === action.leaderId)!
          next = {
            ...next,
            leaderId: leader.id,
            orgUnitId: leader.orgUnitId,
            manualEdits: { ...next.manualEdits, leaderId: true },
          }
        }
        return next
      })

      return { ...snapshot, workplaces: nextWorkplaces }
    }
    case 'reset':
      return seedOrganizationFromWorkplaces()
    case 'clear-persisted-organization':
      localStorage.removeItem(ORG_STORAGE_KEY)
      return seedOrganizationFromWorkplaces()
    default:
      return snapshot
  }
}

function isHistoryAction(action: OrganizationAction): boolean {
  return (
    action.type === 'set-leader-color' ||
    action.type === 'set-workplace-leader' ||
    action.type === 'set-workplace-region' ||
    action.type === 'bulk-set-workplace-assignments'
  )
}

function historyReducer(state: HistoryState, action: OrganizationAction): HistoryState {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]!
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [cloneSnapshot(state.present), ...state.future],
    }
  }

  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const next = state.future[0]!
    return {
      past: [...state.past, cloneSnapshot(state.present)],
      present: next,
      future: state.future.slice(1),
    }
  }

  const nextPresent = applyOrganizationAction(state.present, action)
  if (!nextPresent || nextPresent === state.present) return state

  if (action.type === 'set-snapshot' || action.type === 'reset' || action.type === 'clear-persisted-organization') {
    return {
      past: [],
      present: nextPresent,
      future: [],
    }
  }

  if (!isHistoryAction(action)) {
    return { ...state, present: nextPresent }
  }

  return {
    past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY),
    present: nextPresent,
    future: [],
  }
}

const SnapshotContext = createContext<OrganizationSnapshot | null>(null)
const HydrationContext = createContext<OrganizationHydrationStatus>('loading')
const HistoryMetaContext = createContext<{ canUndo: boolean; canRedo: boolean } | null>(null)
const DispatchContext = createContext<Dispatch<OrganizationAction> | null>(null)

function OrganizationPersistenceBridge({ snapshot }: { snapshot: OrganizationSnapshot }) {
  const { notify } = useNotifications()

  useEffect(() => {
    if (isEmptyOrganizationSeed(snapshot)) return
    const result = saveJson(ORG_STORAGE_KEY, snapshot)
    if (!result.ok) {
      notify({
        type: 'error',
        title: 'Uložení organizace selhalo',
        message:
          result.error === 'quota'
            ? 'localStorage je plné. Exportujte zálohu a uvolněte místo.'
            : 'Organizační data se nepodařilo uložit.',
      })
    }
  }, [snapshot, notify])

  return null
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: loadInitialSnapshot(),
    future: [],
  }))

  const hydrationStatus = useMemo(
    () => resolveHydrationStatus(history.present),
    [history.present],
  )

  return (
    <SnapshotContext.Provider value={history.present}>
      <HydrationContext.Provider value={hydrationStatus}>
        <HistoryMetaContext.Provider
          value={{ canUndo: history.past.length > 0, canRedo: history.future.length > 0 }}
        >
          <DispatchContext.Provider value={dispatch}>
            <OrganizationPersistenceBridge snapshot={history.present} />
            {children}
          </DispatchContext.Provider>
        </HistoryMetaContext.Provider>
      </HydrationContext.Provider>
    </SnapshotContext.Provider>
  )
}

export function useOrganizationSnapshot(): OrganizationSnapshot {
  const context = useContext(SnapshotContext)
  if (!context) throw new Error('useOrganizationSnapshot must be used within OrganizationProvider')
  return context
}

export function useOrganizationHydrationStatus(): OrganizationHydrationStatus {
  const context = useContext(HydrationContext)
  if (!context) throw new Error('useOrganizationHydrationStatus must be used within OrganizationProvider')
  return context
}

/** @deprecated Use useOrganizationSnapshot */
export function useOrganizationState(): { snapshot: OrganizationSnapshot } {
  return { snapshot: useOrganizationSnapshot() }
}

export function useOrganizationDispatch(): Dispatch<OrganizationAction> {
  const context = useContext(DispatchContext)
  if (!context) throw new Error('useOrganizationDispatch must be used within OrganizationProvider')
  return context
}

export function useOrganizationHistory() {
  const context = useContext(HistoryMetaContext)
  if (!context) throw new Error('useOrganizationHistory must be used within OrganizationProvider')
  return context
}

export function useOrganizationActions() {
  const dispatch = useOrganizationDispatch()
  return {
    setSnapshot: (snapshot: OrganizationSnapshot) =>
      dispatch({ type: 'set-snapshot', snapshot }),
    setLeaderColor: (leaderId: string, color: string) =>
      dispatch({ type: 'set-leader-color', leaderId, color }),
    setWorkplaceLeader: (workplaceId: string, leaderId: string) =>
      dispatch({ type: 'set-workplace-leader', workplaceId, leaderId }),
    setWorkplaceRegion: (workplaceId: string, regionId: string) =>
      dispatch({ type: 'set-workplace-region', workplaceId, regionId }),
    bulkSetWorkplaceAssignments: (
      workplaceIds: string[],
      params: { regionId?: string; leaderId?: string },
    ) => dispatch({ type: 'bulk-set-workplace-assignments', workplaceIds, ...params }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    reset: () => dispatch({ type: 'reset' }),
    clearPersistedOrganization: () => dispatch({ type: 'clear-persisted-organization' }),
  }
}

export {
  isEmptyOrganizationSeed,
  isOrganizationSynced,
} from '../domain/organization/organizationState'

export function snapshotToWorkplaces(snapshot: OrganizationSnapshot): Workplace[] {
  if (!isOrganizationSynced(snapshot)) return seedWorkplaces
  return snapshot.workplaces
    .filter((wp) => !wp.absentFromSync)
    .map((wp) => ({
      id: wp.id,
      code: wp.code ?? wp.id.replace(/^wp-/, ''),
      name: wp.name,
    }))
}

export function snapshotToRegionalOffices(snapshot: OrganizationSnapshot): RegionalOffice[] {
  if (!isOrganizationSynced(snapshot)) return seedRegionalOffices
  return snapshot.regions.map((region) => ({
    id: region.id,
    code: region.code,
    name: region.name,
  }))
}
