import { useMemo } from 'react'
import {
  resolveLayeredBoundaryStrokes,
  resolveTerritoryFillStyles,
} from '../domain/color/colorEngine'
import {
  applyRegionFocusColors,
  filterLabelsForRegion,
  filterTerritoryLayersForExport,
  type RegionRenderMode,
} from '../domain/region/regionFocus'
import { getRegionViewport } from '../domain/region/regionViewport'
import { isRegionFocused } from '../domain/region/regionScope'
import type { RegionScope, SvgViewport } from '../domain/region/types'
import { buildMapLabels } from '../domain/labels/labelEngine'
import type { LabelContentMode, LabelSizePreset } from '../domain/labels/labelEngine'
import type { MapLabelFontSizes, MapLabelVisibility } from '../domain/labels/labelSettings'
import { buildTerritoryLayers } from '../domain/territory/territoryEngine'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../domain/territory/workplaceResolver'
import type { BoundaryVisibility, TerritoryLayers } from '../domain/territory/types'
import type { DistrictColorMap, VisualizationContext } from '../domain/visualization/types'
import { useConfigData, useConfigState } from '../store/configStore'
import { useMapState } from '../store/mapStore'
import { useWorkplaceLabelOverrides } from '../store/workplaceLabelOverridesStore'
import { useRegionLabelOverrides } from '../store/regionLabelOverridesStore'
import { visualizationRegistry } from '../domain/visualization/VisualizationRegistry'

export interface UseMapRenderModelInput {
  width: number
  height: number
  colors: DistrictColorMap
  strokeColor?: string
  boundaryVisibility: BoundaryVisibility
  showLabels: boolean
  labelVisibility?: MapLabelVisibility
  labelFontSizes?: MapLabelFontSizes
  labelContentMode?: LabelContentMode
  labelSizePreset?: LabelSizePreset
  labelFontSizePx?: number
  labelHaloSettings?: import('../domain/labels/labelHaloSettings').MapLabelHaloSettings
  /** @deprecated použij labelHaloSettings */
  labelHaloEnabled?: boolean
  labelHideOnCollision?: boolean
  workplaceLabelOverrides?: import('../domain/labels/workplaceLabelOverrides').WorkplaceLabelOverrideMap
  regionLabelOverrides?: import('../domain/labels/regionLabelOverrides').RegionLabelOverrideMap
  context?: VisualizationContext
  separateDistrictStrokes?: boolean
  regionScope?: RegionScope
  regionRenderMode?: RegionRenderMode
  assignmentHash?: string
}

function filterTerritoryLayers(
  territories: TerritoryLayers,
  scope: RegionScope,
  mode: RegionRenderMode,
): TerritoryLayers {
  if (!isRegionFocused(scope)) return territories
  if (mode !== 'interactive' && mode !== 'export-focused') return territories

  const fillPolygons = filterTerritoryLayersForExport(territories.fillPolygons, scope)

  return {
    fillPolygons,
    boundaries: {
      district: territories.boundaries.district.filter((path) =>
        scope.districtIds.has(path.entityId),
      ),
      workplace: territories.boundaries.workplace.filter((path) =>
        scope.workplaceIds.has(path.entityId),
      ),
      region: territories.boundaries.region.filter((path) => path.entityId === scope.regionId),
    },
  }
}

export function useMapRenderModel(input: UseMapRenderModelInput) {
  const config = useConfigState()
  const {
    pluginId,
    labelVisibility,
    labelFontSizes,
    labelSizePreset,
    labelFontSizePx,
    labelHaloSettings,
    labelHaloEnabled,
    labelHideOnCollision,
  } = useMapState()
  const { overrides: workplaceLabelOverrides } = useWorkplaceLabelOverrides()
  const { overrides: regionLabelOverrides } = useRegionLabelOverrides()
  const { districts, workplaces, regionalOffices } = useConfigData()
  const plugin = visualizationRegistry.getById(pluginId)
  const separateDistrictStrokes =
    input.separateDistrictStrokes ?? plugin?.districtInteraction ?? false

  const regionScope = input.regionScope
  const regionRenderMode = input.regionRenderMode ?? 'interactive'

  const resolver = useMemo(
    () =>
      createWorkplaceResolver({
        districts,
        workplaces,
        regionalOffices,
        districtWorkplaceAssignments: config.districtWorkplaceAssignments,
        workplaceRegionalAssignments: config.workplaceRegionalAssignments,
      }),
    [districts, workplaces, regionalOffices, config],
  )

  const assignmentHash = useMemo(
    () =>
      input.assignmentHash ??
      hashAssignmentState(
        config.districtWorkplaceAssignments,
        config.workplaceRegionalAssignments,
      ),
    [
      input.assignmentHash,
      config.districtWorkplaceAssignments,
      config.workplaceRegionalAssignments,
    ],
  )

  const effectiveBoundaries = useMemo(() => {
    if (!regionScope || !isRegionFocused(regionScope)) {
      return input.boundaryVisibility
    }
    return {
      ...input.boundaryVisibility,
      region: true,
    }
  }, [input.boundaryVisibility, regionScope])

  const territories = useMemo(() => {
    const layers = buildTerritoryLayers({
      resolver,
      width: input.width,
      height: input.height,
      boundaryVisibility: effectiveBoundaries,
      assignmentHash,
    })
    if (!regionScope) return layers
    return filterTerritoryLayers(layers, regionScope, regionRenderMode)
  }, [
    resolver,
    input.width,
    input.height,
    effectiveBoundaries,
    assignmentHash,
    regionScope,
    regionRenderMode,
  ])

  const resolvedColors = useMemo(() => {
    if (!regionScope) return input.colors
    return applyRegionFocusColors(input.colors, regionScope, regionRenderMode)
  }, [input.colors, regionScope, regionRenderMode])

  const fillStyles = useMemo(
    () =>
      resolveTerritoryFillStyles(
        {
          districtColors: resolvedColors,
          territories,
          boundaryVisibility: effectiveBoundaries,
          strokeColor: input.strokeColor,
          separateDistrictStrokes,
        },
        (districtId) => resolver.getWorkplaceIdForDistrict(districtId),
      ),
    [
      resolvedColors,
      territories,
      effectiveBoundaries,
      input.strokeColor,
      separateDistrictStrokes,
      resolver,
    ],
  )

  const boundaryLayers = useMemo(
    () => resolveLayeredBoundaryStrokes(territories),
    [territories],
  )

  const labels = useMemo(() => {
    if (!input.showLabels) return []
    const built = buildMapLabels({
      resolver,
      territories,
      labelVisibility: input.labelVisibility ?? labelVisibility,
      labelFontSizes: input.labelFontSizes ?? labelFontSizes,
      width: input.width,
      height: input.height,
      assignmentHash,
      contentMode: input.labelContentMode ?? 'name',
      context: input.context,
      labelSizePreset: input.labelSizePreset ?? labelSizePreset,
      labelFontSizePx: input.labelFontSizePx ?? labelFontSizePx,
      labelHaloSettings: input.labelHaloSettings ?? labelHaloSettings,
      labelHaloEnabled: input.labelHaloEnabled ?? labelHaloEnabled,
      labelHideOnCollision: input.labelHideOnCollision ?? labelHideOnCollision,
      workplaceLabelOverrides: input.workplaceLabelOverrides ?? workplaceLabelOverrides,
      regionLabelOverrides: input.regionLabelOverrides ?? regionLabelOverrides,
    })
    if (!regionScope) return built
    return filterLabelsForRegion(built, regionScope)
  }, [
    resolver,
    territories,
    input.showLabels,
    input.labelVisibility,
    input.labelFontSizes,
    input.labelContentMode,
    input.labelSizePreset,
    input.labelFontSizePx,
    input.labelHaloSettings,
    input.labelHaloEnabled,
    input.labelHideOnCollision,
    input.workplaceLabelOverrides,
    input.regionLabelOverrides,
    input.context,
    input.width,
    input.height,
    assignmentHash,
    regionScope,
    labelVisibility,
    labelFontSizes,
    labelSizePreset,
    labelFontSizePx,
    labelHaloSettings,
    labelHaloEnabled,
    labelHideOnCollision,
    workplaceLabelOverrides,
    regionLabelOverrides,
  ])

  const viewport: SvgViewport | null = useMemo(() => {
    if (!regionScope || !isRegionFocused(regionScope) || !regionScope.regionId) {
      return null
    }
    return getRegionViewport(
      regionScope.regionId,
      [...regionScope.districtIds],
      input.width,
      input.height,
      assignmentHash,
    )
  }, [regionScope, input.width, input.height, assignmentHash])

  return {
    resolver,
    territories,
    fillStyles,
    boundaryLayers,
    labels,
    viewport,
    regionScope,
  }
}
