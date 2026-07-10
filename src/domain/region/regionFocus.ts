import type { MapLabel } from '../labels/labelEngine'
import { getRecordForDistrict } from '../visualization/contextUtils'
import type {
  DistrictColorMap,
  LegendSpec,
  VisualizationContext,
} from '../visualization/types'
import { OUTSIDE_REGION_FILL, isDistrictInScope, isRegionFocused, isWorkplaceInScope } from './regionScope'
import type { RegionScope } from './types'

export type RegionRenderMode = 'interactive' | 'export-country' | 'export-focused'

export function applyRegionFocusColors(
  colors: DistrictColorMap,
  scope: RegionScope,
  mode: RegionRenderMode,
): DistrictColorMap {
  if (!isRegionFocused(scope) || mode === 'export-focused') {
    if (mode !== 'export-focused') return colors

    const filtered: DistrictColorMap = {}
    for (const [districtId, style] of Object.entries(colors)) {
      if (isDistrictInScope(scope, districtId)) {
        filtered[districtId] = style
      }
    }
    return filtered
  }

  const result: DistrictColorMap = { ...colors }
  for (const districtId of Object.keys(colors)) {
    if (!isDistrictInScope(scope, districtId)) {
      result[districtId] = { fill: OUTSIDE_REGION_FILL }
    }
  }
  return result
}

export function filterLabelsForRegion(labels: MapLabel[], scope: RegionScope): MapLabel[] {
  if (!isRegionFocused(scope)) return labels

  return labels.filter((label) => {
    if (label.level === 'district') {
      const districtId = label.id.replace(/^label-district-/, '')
      return isDistrictInScope(scope, districtId)
    }
    if (label.level === 'workplace') {
      const workplaceId = label.id.replace(/^label-workplace-/, '')
      return isWorkplaceInScope(scope, workplaceId)
    }
    if (label.level === 'region') {
      const regionId = label.id.replace(/^label-region-/, '')
      return scope.regionId === regionId
    }
    return true
  })
}

export function filterLegendForRegion(
  legend: LegendSpec,
  pluginId: string,
  scope: RegionScope,
  context: VisualizationContext,
): LegendSpec {
  if (!isRegionFocused(scope)) return legend

  if (legend.scale) {
    return legend
  }

  const filteredItems = legend.items.filter((item) => {
    switch (pluginId) {
      case 'by-leader':
        return context.organization?.workplaces.some(
          (wp) => wp.leaderId === item.id && isWorkplaceInScope(scope, wp.id),
        )
      case 'by-workplace':
        return isWorkplaceInScope(scope, item.id)
      case 'by-regional-office':
        return item.id === scope.regionId
      case 'by-district':
        return isDistrictInScope(scope, item.id)
      case 'categorical': {
        if (item.id === '__no_data__') {
          return context.districts.some((district) => {
            if (!isDistrictInScope(scope, district.id)) return false
            const record = getRecordForDistrict(context, district.id)
            const raw = context.column ? record?.values[context.column.key] : null
            return raw === null || raw === undefined || raw === ''
          })
        }
        return context.districts.some((district) => {
          if (!isDistrictInScope(scope, district.id)) return false
          const record = getRecordForDistrict(context, district.id)
          const raw = context.column ? record?.values[context.column.key] : null
          return String(raw ?? '') === item.id
        })
      }
      case 'neutral':
        return true
      default:
        return true
    }
  })

  return {
    ...legend,
    items: filteredItems,
  }
}

export function filterTerritoryLayersForExport<T extends { entityId: string }>(
  polygons: T[],
  scope: RegionScope,
): T[] {
  if (!isRegionFocused(scope)) return polygons
  return polygons.filter((polygon) => isDistrictInScope(scope, polygon.entityId))
}

export function getInteractiveDistrictIds(scope: RegionScope): Set<string> | null {
  if (!isRegionFocused(scope)) return null
  return new Set(scope.districtIds)
}
