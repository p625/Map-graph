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
  loadPersistedRegionLabelOverrides,
  sanitizeRegionLabelOverrides,
  serializeRegionLabelOverrides,
  REGION_LABEL_OVERRIDES_KEY,
  type RegionLabelOverride,
  type RegionLabelOverrideMap,
} from '../domain/labels/regionLabelOverrides'
import { loadJson, saveJson } from '../utils/storage'
import { useNotifications } from './notificationStore'
import type { LabelOverridesHydrationStatus } from './workplaceLabelOverridesStore'

interface RegionLabelOverridesContextValue {
  hydrationStatus: LabelOverridesHydrationStatus
  overrides: RegionLabelOverrideMap
  setOverride: (regionId: string, patch: Partial<RegionLabelOverride>) => void
  resetOverride: (regionId: string) => void
  resetPosition: (regionId: string) => void
  resetText: (regionId: string) => void
  resetAllOverrides: () => void
}

const RegionLabelOverridesContext = createContext<RegionLabelOverridesContextValue | null>(null)

function mergeOverride(
  regionId: string,
  current: RegionLabelOverrideMap,
  patch: Partial<RegionLabelOverride>,
): RegionLabelOverrideMap {
  const existing = current[regionId] ?? { regionId }
  const next = {
    ...existing,
    ...patch,
    regionId,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }
  const sanitized = sanitizeRegionLabelOverrides({ [regionId]: next })
  if (!sanitized[regionId]) {
    const copy = { ...current }
    delete copy[regionId]
    return copy
  }
  return { ...current, [regionId]: sanitized[regionId] }
}

export function RegionLabelOverridesProvider({ children }: { children: ReactNode }) {
  const { notify } = useNotifications()
  const hydratedRef = useRef(false)
  const [hydrationStatus, setHydrationStatus] = useState<LabelOverridesHydrationStatus>('loading')
  const [overrides, setOverrides] = useState<RegionLabelOverrideMap>(() =>
    loadPersistedRegionLabelOverrides(loadJson),
  )

  useEffect(() => {
    hydratedRef.current = true
    setHydrationStatus('ready')
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    const result = saveJson(REGION_LABEL_OVERRIDES_KEY, serializeRegionLabelOverrides(overrides))
    if (!result.ok) {
      notify({
        type: 'error',
        title: 'Uložení pozic popisků regionů selhalo',
        message:
          result.error === 'quota'
            ? 'localStorage je plné — pozice popisků se nemusí obnovit po restartu.'
            : 'Popisky regionů se nepodařilo uložit.',
      })
      setHydrationStatus('invalid')
    }
  }, [overrides, notify])

  const setOverride = useCallback((regionId: string, patch: Partial<RegionLabelOverride>) => {
    setOverrides((current) => mergeOverride(regionId, current, patch))
  }, [])

  const resetOverride = useCallback((regionId: string) => {
    setOverrides((current) => {
      const copy = { ...current }
      delete copy[regionId]
      return copy
    })
  }, [])

  const resetPosition = useCallback((regionId: string) => {
    setOverrides((current) => {
      const existing = current[regionId]
      if (!existing) return current
      const next = {
        ...existing,
        offsetX: undefined,
        offsetY: undefined,
        manualPosition: existing.displayText || existing.fontSizePx ? true : undefined,
        updatedAt: new Date().toISOString(),
      }
      return mergeOverride(regionId, current, next)
    })
  }, [])

  const resetText = useCallback((regionId: string) => {
    setOverrides((current) => {
      const existing = current[regionId]
      if (!existing) return current
      return mergeOverride(regionId, current, {
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
    <RegionLabelOverridesContext.Provider value={value}>{children}</RegionLabelOverridesContext.Provider>
  )
}

export function useRegionLabelOverrides() {
  const context = useContext(RegionLabelOverridesContext)
  if (!context) {
    throw new Error('useRegionLabelOverrides must be used within RegionLabelOverridesProvider')
  }
  return context
}
