import { useMemo } from 'react'
import { districts } from '../data/seed/districts'
import { filterLegendForRegion, applyRegionFocusColors } from '../domain/region/regionFocus'
import { getThemeById } from '../domain/visualization/themes'
import type { VisualizationContext } from '../domain/visualization/types'
import { visualizationRegistry } from '../domain/visualization/VisualizationRegistry'
import { useConfigData, useConfigState } from '../store/configStore'
import { isOrganizationSynced } from '../store/organizationStore'
import { useActiveDataset } from '../store/datasetStore'
import { useMapState } from '../store/mapStore'
import { useRegionScope } from './useRegionScope'

export function useVisualizationContext(): VisualizationContext {
  const config = useConfigState()
  const { workplaces, regionalOffices, organizationSnapshot } = useConfigData()
  const { datasetId, columnKey, themeId } = useMapState()
  const { dataset, records } = useActiveDataset(datasetId)
  const theme = getThemeById(themeId)
  const orgSynced = isOrganizationSynced(organizationSnapshot)
  const regionScope = useRegionScope()

  return useMemo(() => {
    const column = dataset?.columns.find((item) => item.key === columnKey)
    return {
      districts,
      workplaces,
      regionalOffices,
      districtWorkplaceAssignments: config.districtWorkplaceAssignments,
      workplaceRegionalAssignments: config.workplaceRegionalAssignments,
      districtDisplayColors: config.districtDisplayColors,
      workplaceDisplayColors: config.workplaceDisplayColors,
      regionDisplayColors: config.regionDisplayColors,
      organization: orgSynced
        ? {
            leaders: organizationSnapshot.leaders,
            orgUnits: organizationSnapshot.orgUnits,
            workplaces: organizationSnapshot.workplaces.filter((wp) => !wp.absentFromSync),
          }
        : undefined,
      regionScope,
      dataset: dataset ?? undefined,
      records: records.length > 0 ? records : undefined,
      column,
      theme,
    }
  }, [
    config,
    workplaces,
    regionalOffices,
    organizationSnapshot,
    orgSynced,
    regionScope,
    dataset,
    records,
    columnKey,
    theme,
  ])
}

export function useActiveVisualization() {
  const context = useVisualizationContext()
  const { pluginId } = useMapState()

  return useMemo(() => {
    const plugin = visualizationRegistry.getById(pluginId) ?? visualizationRegistry.getById('neutral')!
    const baseColors = plugin.resolveColors(context)
    const colors = applyRegionFocusColors(baseColors, context.regionScope!, 'interactive')
    const baseLegend = plugin.buildLegend(context)
    const legend = filterLegendForRegion(baseLegend, plugin.id, context.regionScope!, context)
    return { plugin, colors, legend, context }
  }, [context, pluginId])
}
