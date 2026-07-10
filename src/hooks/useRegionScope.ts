import { useEffect, useMemo } from 'react'
import { buildRegionScope } from '../domain/region/regionScope'
import type { RegionScope } from '../domain/region/types'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../domain/territory/workplaceResolver'
import { useConfigData, useConfigState } from '../store/configStore'
import { isOrganizationSynced } from '../store/organizationStore'
import { useMapActions, useMapState } from '../store/mapStore'

export function useRegionScope(): RegionScope {
  const { focusedRegionId, regionViewMode } = useMapState()
  const config = useConfigState()
  const { workplaces, regionalOffices } = useConfigData()

  const resolver = useMemo(
    () =>
      createWorkplaceResolver({
        workplaces,
        regionalOffices,
        districtWorkplaceAssignments: config.districtWorkplaceAssignments,
        workplaceRegionalAssignments: config.workplaceRegionalAssignments,
      }),
    [workplaces, regionalOffices, config],
  )

  return useMemo(
    () => buildRegionScope(focusedRegionId, regionViewMode, resolver),
    [focusedRegionId, regionViewMode, resolver],
  )
}

export function useValidateFocusedRegion() {
  const { focusedRegionId } = useMapState()
  const { validateFocusedRegion } = useMapActions()
  const { organizationSnapshot } = useConfigData()
  const synced = isOrganizationSynced(organizationSnapshot)

  useEffect(() => {
    if (!focusedRegionId) return
    const validIds = synced ? organizationSnapshot.regions.map((region) => region.id) : []
    validateFocusedRegion(validIds)
  }, [focusedRegionId, synced, organizationSnapshot.regions, validateFocusedRegion])
}

export function useRegionResolver() {
  const config = useConfigState()
  const { workplaces, regionalOffices } = useConfigData()

  return useMemo(
    () =>
      createWorkplaceResolver({
        workplaces,
        regionalOffices,
        districtWorkplaceAssignments: config.districtWorkplaceAssignments,
        workplaceRegionalAssignments: config.workplaceRegionalAssignments,
      }),
    [workplaces, regionalOffices, config],
  )
}

export function useAssignmentHash() {
  const config = useConfigState()
  return useMemo(
    () =>
      hashAssignmentState(
        config.districtWorkplaceAssignments,
        config.workplaceRegionalAssignments,
      ),
    [config.districtWorkplaceAssignments, config.workplaceRegionalAssignments],
  )
}
