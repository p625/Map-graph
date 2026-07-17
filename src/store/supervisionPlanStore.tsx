import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { createDefaultSupervisionPlan } from '../domain/supervision-plan/supervisionPlanDefaults'
import { sanitizeSupervisionPlan } from '../domain/supervision-plan/supervisionPlanSanitize'
import { syncSupervisionPlanWithOrganization } from '../domain/supervision-plan/syncWithOrganization'
import {
  SUPERVISION_PLAN_STORAGE_KEY,
  type SupervisionPlan,
  type SupervisionPlanYearConfig,
} from '../domain/supervision-plan/types'
import { loadJson, saveJson } from '../utils/storage'
import { useOrganizationSnapshot } from './organizationStore'
import { useNotifications } from './notificationStore'

type SupervisionPlanAction =
  | { type: 'replace'; plan: SupervisionPlan }
  | { type: 'set-name'; name: string }
  | { type: 'assign-year'; workplaceIds: string[]; year: number | null }
  | { type: 'set-note'; workplaceId: string; note: string }
  | { type: 'add-year'; year: number; color?: string }
  | { type: 'remove-year'; year: number }
  | { type: 'update-year'; year: number; patch: Partial<SupervisionPlanYearConfig> }
  | { type: 'reorder-years'; years: SupervisionPlanYearConfig[] }
  | { type: 'reset-plan' }

function touch(plan: SupervisionPlan): SupervisionPlan {
  return { ...plan, updatedAt: new Date().toISOString() }
}

function supervisionPlanReducer(state: SupervisionPlan, action: SupervisionPlanAction): SupervisionPlan {
  switch (action.type) {
    case 'replace':
      return action.plan
    case 'set-name':
      return touch({ ...state, name: action.name })
    case 'assign-year': {
      const assignments = { ...state.assignments }
      const now = new Date().toISOString()
      for (const workplaceId of action.workplaceIds) {
        if (action.year === null) {
          const existing = assignments[workplaceId]
          if (existing?.note) {
            assignments[workplaceId] = { workplaceId, plannedYear: null, note: existing.note, updatedAt: now }
          } else {
            delete assignments[workplaceId]
          }
        } else {
          assignments[workplaceId] = {
            workplaceId,
            plannedYear: action.year,
            note: assignments[workplaceId]?.note,
            updatedAt: now,
          }
        }
      }
      return touch({ ...state, assignments })
    }
    case 'set-note': {
      const assignments = { ...state.assignments }
      const existing = assignments[action.workplaceId]
      const plannedYear = existing?.plannedYear ?? null
      if (!action.note.trim() && plannedYear === null) {
        delete assignments[action.workplaceId]
      } else {
        assignments[action.workplaceId] = {
          workplaceId: action.workplaceId,
          plannedYear,
          note: action.note.trim() || undefined,
          updatedAt: new Date().toISOString(),
        }
      }
      return touch({ ...state, assignments })
    }
    case 'add-year': {
      if (state.years.some((y) => y.year === action.year)) return state
      const color =
        action.color ??
        ['#2563eb', '#16a34a', '#ea580c', '#9333ea'][(state.years.length % 4) as 0 | 1 | 2 | 3]!
      return touch({
        ...state,
        years: [...state.years, { year: action.year, color, isActive: true }].sort(
          (a, b) => a.year - b.year,
        ),
      })
    }
    case 'remove-year': {
      const years = state.years.filter((y) => y.year !== action.year)
      const assignments = { ...state.assignments }
      for (const [workplaceId, assignment] of Object.entries(assignments)) {
        if (assignment.plannedYear === action.year) {
          if (assignment.note) {
            assignments[workplaceId] = { ...assignment, plannedYear: null, updatedAt: new Date().toISOString() }
          } else {
            delete assignments[workplaceId]
          }
        }
      }
      return touch({ ...state, years, assignments })
    }
    case 'update-year':
      return touch({
        ...state,
        years: state.years.map((y) => (y.year === action.year ? { ...y, ...action.patch, year: y.year } : y)),
      })
    case 'reorder-years':
      return touch({ ...state, years: action.years })
    case 'reset-plan':
      return createDefaultSupervisionPlan()
    default:
      return state
  }
}

function loadInitialPlan(): SupervisionPlan {
  const stored = loadJson<unknown>(SUPERVISION_PLAN_STORAGE_KEY, null)
  return sanitizeSupervisionPlan(stored)
}

const SupervisionPlanContext = createContext<SupervisionPlan | null>(null)
const SupervisionPlanDispatchContext = createContext<Dispatch<SupervisionPlanAction> | null>(null)

export function SupervisionPlanProvider({ children }: { children: ReactNode }) {
  const [plan, dispatch] = useReducer(supervisionPlanReducer, undefined, loadInitialPlan)
  const snapshot = useOrganizationSnapshot()
  const { notify } = useNotifications()

  useEffect(() => {
    const active = snapshot.workplaces.filter((wp) => !wp.absentFromSync)
    const synced = syncSupervisionPlanWithOrganization(plan, active)
    if (synced !== plan) {
      dispatch({ type: 'replace', plan: synced })
    }
  }, [snapshot.workplaces, plan])

  useEffect(() => {
    const result = saveJson(SUPERVISION_PLAN_STORAGE_KEY, plan)
    if (!result.ok) {
      notify({
        type: 'error',
        title: 'Uložení plánu supervizí selhalo',
        message: result.error === 'quota' ? 'localStorage je plné.' : 'Plán se nepodařilo uložit.',
      })
    }
  }, [plan, notify])

  return (
    <SupervisionPlanContext.Provider value={plan}>
      <SupervisionPlanDispatchContext.Provider value={dispatch}>{children}</SupervisionPlanDispatchContext.Provider>
    </SupervisionPlanContext.Provider>
  )
}

export function useSupervisionPlan(): SupervisionPlan {
  const context = useContext(SupervisionPlanContext)
  if (!context) throw new Error('useSupervisionPlan must be used within SupervisionPlanProvider')
  return context
}

export function useSupervisionPlanActions() {
  const dispatch = useContext(SupervisionPlanDispatchContext)
  if (!dispatch) throw new Error('useSupervisionPlanActions must be used within SupervisionPlanProvider')

  return useMemo(
    () => ({
      setPlanName: (name: string) => dispatch({ type: 'set-name', name }),
      assignYear: (workplaceIds: string[], year: number | null) =>
        dispatch({ type: 'assign-year', workplaceIds, year }),
      setNote: (workplaceId: string, note: string) => dispatch({ type: 'set-note', workplaceId, note }),
      addYear: (year: number, color?: string) => dispatch({ type: 'add-year', year, color }),
      removeYear: (year: number) => dispatch({ type: 'remove-year', year }),
      updateYear: (year: number, patch: Partial<SupervisionPlanYearConfig>) =>
        dispatch({ type: 'update-year', year, patch }),
      reorderYears: (years: SupervisionPlanYearConfig[]) => dispatch({ type: 'reorder-years', years }),
      resetPlan: () => dispatch({ type: 'reset-plan' }),
    }),
    [dispatch],
  )
}

export function countWorkplacesForYear(plan: SupervisionPlan, year: number): number {
  return Object.values(plan.assignments).filter((a) => a.plannedYear === year).length
}
