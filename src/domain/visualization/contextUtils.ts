import type { District } from '../types/district'
import type { DistrictId, DistrictColorMap, VisualizationContext } from './types'
import { isRegionFocused } from '../region/regionScope'
import { NO_DATA_FILL } from './colorUtils'

export function createEmptyColorMap(
  context: VisualizationContext,
  fill: string = NO_DATA_FILL,
): DistrictColorMap {
  return Object.fromEntries(
    context.districts.map((district) => [district.id, { fill }]),
  ) as DistrictColorMap
}

export function getWorkplaceForDistrict(
  context: VisualizationContext,
  districtId: DistrictId,
): string | null {
  return context.districtWorkplaceAssignments[districtId] ?? null
}

export function getRegionalOfficeForWorkplace(
  context: VisualizationContext,
  workplaceId: string,
): string | null {
  return context.workplaceRegionalAssignments[workplaceId] ?? null
}

export function getRecordForDistrict(
  context: VisualizationContext,
  districtId: DistrictId,
) {
  const workplaceId = getWorkplaceForDistrict(context, districtId)
  if (!workplaceId || !context.records) return null
  return context.records.find((record) => record.workplaceId === workplaceId) ?? null
}

export function getNumericColumnValue(
  record: { values: Record<string, unknown> } | null,
  columnKey?: string,
): number | null {
  if (!record || !columnKey) return null
  const raw = record.values[columnKey]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const normalized = raw.replace('%', '').replace(',', '.').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function getScopedDistricts(context: VisualizationContext): District[] {
  const scope = context.regionScope
  if (!scope || !isRegionFocused(scope)) {
    return context.districts
  }
  return context.districts.filter((district) => scope.districtIds.has(district.id))
}
