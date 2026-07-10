import type { WorkplaceResolver } from '../territory/workplaceResolver'
import type { RegionScope, RegionViewMode } from './types'

export const OUTSIDE_REGION_FILL = '#e2e8f0'

export function buildRegionScope(
  focusedRegionId: string | null,
  regionViewMode: RegionViewMode,
  resolver: WorkplaceResolver,
): RegionScope {
  if (!focusedRegionId || regionViewMode !== 'focused') {
    return {
      mode: 'overview',
      regionId: null,
      regionName: null,
      districtIds: new Set(resolver.districts.map((d) => d.id)),
      workplaceIds: new Set(resolver.workplaces.map((w) => w.id)),
    }
  }

  const region = resolver.getRegion(focusedRegionId)
  const districtIds = resolver.getDistrictIdsForRegion(focusedRegionId)
  const workplaceIds = resolver.getWorkplacesForRegion(focusedRegionId).map((w) => w.id)

  return {
    mode: 'focused',
    regionId: focusedRegionId,
    regionName: region?.name ?? focusedRegionId,
    districtIds: new Set(districtIds),
    workplaceIds: new Set(workplaceIds),
  }
}

export function isRegionFocused(scope: RegionScope): boolean {
  return scope.mode === 'focused' && scope.regionId !== null
}

export function isDistrictInScope(scope: RegionScope, districtId: string): boolean {
  return scope.districtIds.has(districtId)
}

export function isWorkplaceInScope(scope: RegionScope, workplaceId: string): boolean {
  return scope.workplaceIds.has(workplaceId)
}
