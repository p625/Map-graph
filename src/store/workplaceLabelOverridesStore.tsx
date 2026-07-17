import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  loadPersistedWorkplaceLabelOverrides,
  sanitizeWorkplaceLabelOverrides,
  serializeWorkplaceLabelOverrides,
  WORKPLACE_LABEL_OVERRIDES_KEY,
  type WorkplaceLabelOverride,
  type WorkplaceLabelOverrideMap,
} from '../domain/labels/workplaceLabelOverrides'
import { loadJson, saveJson } from '../utils/storage'
import { useNotifications } from './notificationStore'

export type LabelOverridesHydrationStatus = 'loading' | 'ready' | 'invalid'

interface WorkplaceLabelOverridesContextValue {
  hydrationStatus: LabelOverridesHydrationStatus
  overrides: WorkplaceLabelOverrideMap
  setOverride: (workplaceId: string, patch: Partial<WorkplaceLabelOverride>) => void
  resetOverride: (workplaceId: string) => void
  resetPosition: (workplaceId: string) => void
  resetText: (workplaceId: string) => void
  resetAllOverrides: () => void
}

const WorkplaceLabelOverridesContext =
  createContext<WorkplaceLabelOverridesContextValue | null>(null)

function mergeOverride(
  workplaceId: string,
  current: WorkplaceLabelOverrideMap,
  patch: Partial<WorkplaceLabelOverride>,
): WorkplaceLabelOverrideMap {
  const existing = current[workplaceId] ?? { workplaceId }
  const next = {
    ...existing,
    ...patch,
    workplaceId,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }
  const sanitized = sanitizeWorkplaceLabelOverrides({ [workplaceId]: next })
  if (!sanitized[workplaceId]) {
    const copy = { ...current }
    delete copy[workplaceId]
    return copy
  }
  return { ...current, [workplaceId]: sanitized[workplaceId] }
}

export function WorkplaceLabelOverridesProvider({ children }: { children: ReactNode }) {
  const { notify } = useNotifications()
  const hydratedRef = useRef(false)
  const [hydrationStatus, setHydrationStatus] = useState<LabelOverridesHydrationStatus>('loading')
  const [overrides, setOverrides] = useState<WorkplaceLabelOverrideMap>(() =>
    loadPersistedWorkplaceLabelOverrides(loadJson),
  )

  useEffect(() => {
    hydratedRef.current = true
    setHydrationStatus('ready')
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    const result = saveJson(WORKPLACE_LABEL_OVERRIDES_KEY, serializeWorkplaceLabelOverrides(overrides))
    if (!result.ok) {
      notify({
        type: 'error',
        title: 'Uložení pozic popisků selhalo',
        message:
          result.error === 'quota'
            ? 'localStorage je plné — pozice popisků se nemusí obnovit po restartu.'
            : 'Popisky pracovišť se nepodařilo uložit.',
      })
      setHydrationStatus('invalid')
    }
  }, [overrides, notify])

  const setOverride = useCallback((workplaceId: string, patch: Partial<WorkplaceLabelOverride>) => {
    setOverrides((current) => mergeOverride(workplaceId, current, patch))
  }, [])

  const resetOverride = useCallback((workplaceId: string) => {
    setOverrides((current) => {
      const copy = { ...current }
      delete copy[workplaceId]
      return copy
    })
  }, [])

  const resetPosition = useCallback((workplaceId: string) => {
    setOverrides((current) => {
      const existing = current[workplaceId]
      if (!existing) return current
      const next = {
        ...existing,
        offsetX: undefined,
        offsetY: undefined,
        manualPosition: existing.displayText || existing.fontSizePx ? true : undefined,
        updatedAt: new Date().toISOString(),
      }
      return mergeOverride(workplaceId, current, next)
    })
  }, [])

  const resetText = useCallback((workplaceId: string) => {
    setOverrides((current) => {
      const existing = current[workplaceId]
      if (!existing) return current
      return mergeOverride(workplaceId, current, {
        displayText: undefined,
        updatedAt: new Date().toISOString(),
      })
    })
  }, [])

  const resetAllOverrides = useCallback(() => {
    setOverrides({})
  }, [])

  const value = useMemo(
    () => ({
      hydrationStatus,
      overrides,
      setOverride,
      resetOverride,
      resetPosition,
      resetText,
      resetAllOverrides,
    }),
    [hydrationStatus, overrides, setOverride, resetOverride, resetPosition, resetText, resetAllOverrides],
  )

  return (
    <WorkplaceLabelOverridesContext.Provider value={value}>
      {children}
    </WorkplaceLabelOverridesContext.Provider>
  )
}

export function useWorkplaceLabelOverrides() {
  const context = useContext(WorkplaceLabelOverridesContext)
  if (!context) {
    throw new Error('useWorkplaceLabelOverrides must be used within WorkplaceLabelOverridesProvider')
  }
  return context
}
