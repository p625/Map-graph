import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  REGION_LABEL_OVERRIDES_KEY,
  sanitizeRegionLabelOverrides,
  sanitizeWorkplaceLabelOverrides,
  WORKPLACE_LABEL_OVERRIDES_KEY,
  type LabelPositionOverride,
  type RegionLabelOverrideMap,
  type WorkplaceLabelOverrideMap,
} from '../domain/labels/labelOverrides'
import { loadJson, saveJson } from '../utils/storage'

interface LabelOverridesContextValue {
  workplaceOverrides: WorkplaceLabelOverrideMap
  regionOverrides: RegionLabelOverrideMap
  setWorkplaceOverride: (workplaceId: string, patch: Partial<LabelPositionOverride>) => void
  setRegionOverride: (regionId: string, patch: Partial<LabelPositionOverride>) => void
  resetWorkplaceOverride: (workplaceId: string) => void
  resetRegionOverride: (regionId: string) => void
  resetAllWorkplaceOverrides: () => void
  resetAllRegionOverrides: () => void
  resetAllLabelOverrides: () => void
}

const LabelOverridesContext = createContext<LabelOverridesContextValue | null>(null)

function mergeWorkplace(
  workplaceId: string,
  current: WorkplaceLabelOverrideMap,
  patch: Partial<LabelPositionOverride>,
): WorkplaceLabelOverrideMap {
  const next = { ...current[workplaceId], ...patch, workplaceId }
  const sanitized = sanitizeWorkplaceLabelOverrides({ [workplaceId]: next })
  if (!sanitized[workplaceId]) {
    const copy = { ...current }
    delete copy[workplaceId]
    return copy
  }
  return { ...current, [workplaceId]: sanitized[workplaceId] }
}

function mergeRegion(
  regionId: string,
  current: RegionLabelOverrideMap,
  patch: Partial<LabelPositionOverride>,
): RegionLabelOverrideMap {
  const next = { ...current[regionId], ...patch, regionId }
  const sanitized = sanitizeRegionLabelOverrides({ [regionId]: next })
  if (!sanitized[regionId]) {
    const copy = { ...current }
    delete copy[regionId]
    return copy
  }
  return { ...current, [regionId]: sanitized[regionId] }
}

export function LabelOverridesProvider({ children }: { children: ReactNode }) {
  const [workplaceOverrides, setWorkplaceOverrides] = useState<WorkplaceLabelOverrideMap>(() =>
    sanitizeWorkplaceLabelOverrides(loadJson(WORKPLACE_LABEL_OVERRIDES_KEY, {})),
  )
  const [regionOverrides, setRegionOverrides] = useState<RegionLabelOverrideMap>(() =>
    sanitizeRegionLabelOverrides(loadJson(REGION_LABEL_OVERRIDES_KEY, {})),
  )

  useEffect(() => {
    saveJson(WORKPLACE_LABEL_OVERRIDES_KEY, workplaceOverrides)
  }, [workplaceOverrides])

  useEffect(() => {
    saveJson(REGION_LABEL_OVERRIDES_KEY, regionOverrides)
  }, [regionOverrides])

  const setWorkplaceOverride = useCallback(
    (workplaceId: string, patch: Partial<LabelPositionOverride>) => {
      setWorkplaceOverrides((current) => mergeWorkplace(workplaceId, current, patch))
    },
    [],
  )

  const setRegionOverride = useCallback((regionId: string, patch: Partial<LabelPositionOverride>) => {
    setRegionOverrides((current) => mergeRegion(regionId, current, patch))
  }, [])

  const resetWorkplaceOverride = useCallback((workplaceId: string) => {
    setWorkplaceOverrides((current) => {
      const copy = { ...current }
      delete copy[workplaceId]
      return copy
    })
  }, [])

  const resetRegionOverride = useCallback((regionId: string) => {
    setRegionOverrides((current) => {
      const copy = { ...current }
      delete copy[regionId]
      return copy
    })
  }, [])

  const resetAllWorkplaceOverrides = useCallback(() => setWorkplaceOverrides({}), [])
  const resetAllRegionOverrides = useCallback(() => setRegionOverrides({}), [])
  const resetAllLabelOverrides = useCallback(() => {
    setWorkplaceOverrides({})
    setRegionOverrides({})
  }, [])

  const value = useMemo(
    () => ({
      workplaceOverrides,
      regionOverrides,
      setWorkplaceOverride,
      setRegionOverride,
      resetWorkplaceOverride,
      resetRegionOverride,
      resetAllWorkplaceOverrides,
      resetAllRegionOverrides,
      resetAllLabelOverrides,
    }),
    [
      workplaceOverrides,
      regionOverrides,
      setWorkplaceOverride,
      setRegionOverride,
      resetWorkplaceOverride,
      resetRegionOverride,
      resetAllWorkplaceOverrides,
      resetAllRegionOverrides,
      resetAllLabelOverrides,
    ],
  )

  return (
    <LabelOverridesContext.Provider value={value}>{children}</LabelOverridesContext.Provider>
  )
}

export function useLabelOverrides() {
  const context = useContext(LabelOverridesContext)
  if (!context) {
    throw new Error('useLabelOverrides must be used within LabelOverridesProvider')
  }
  return context
}

/** Kompatibilní alias */
export function useWorkplaceLabelOverrides() {
  const ctx = useLabelOverrides()
  return {
    overrides: ctx.workplaceOverrides,
    setOverride: ctx.setWorkplaceOverride,
    resetOverride: ctx.resetWorkplaceOverride,
    resetAllOverrides: ctx.resetAllWorkplaceOverrides,
  }
}

export const WorkplaceLabelOverridesProvider = LabelOverridesProvider
