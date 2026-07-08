import { useMemo } from 'react'
import { districts } from '../data/seed/districts'
import { getThemeById } from '../domain/visualization/themes'
import type { VisualizationContext } from '../domain/visualization/types'
import { visualizationRegistry } from '../domain/visualization/VisualizationRegistry'
import { useConfigData, useConfigState } from '../store/configStore'
import { useActiveDataset } from '../store/datasetStore'
import { useMapState } from '../store/mapStore'

export function useVisualizationContext(): VisualizationContext {
  const config = useConfigState()
  const { workplaces, regionalOffices } = useConfigData()
  const { datasetId, columnKey, themeId } = useMapState()
  const { dataset, records } = useActiveDataset(datasetId)
  const theme = getThemeById(themeId)

  return useMemo(() => {
    const column = dataset?.columns.find((item) => item.key === columnKey)
    return {
      districts,
      workplaces,
      regionalOffices,
      districtWorkplaceAssignments: config.districtWorkplaceAssignments,
      workplaceRegionalAssignments: config.workplaceRegionalAssignments,
      dataset: dataset ?? undefined,
      records: records.length > 0 ? records : undefined,
      column,
      theme,
    }
  }, [config, workplaces, regionalOffices, dataset, records, columnKey, theme])
}

export function useActiveVisualization() {
  const context = useVisualizationContext()
  const { pluginId } = useMapState()

  return useMemo(() => {
    const plugin = visualizationRegistry.getById(pluginId) ?? visualizationRegistry.getById('neutral')!
    const colors = plugin.resolveColors(context)
    const legend = plugin.buildLegend(context)
    return { plugin, colors, legend, context }
  }, [context, pluginId])
}
