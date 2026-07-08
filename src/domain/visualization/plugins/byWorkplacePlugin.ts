import type { VisualizationPlugin } from '../types'
import { colorFromPalette } from '../colorUtils'
import { createEmptyColorMap, getWorkplaceForDistrict } from '../contextUtils'

export const byWorkplacePlugin: VisualizationPlugin = {
  id: 'by-workplace',
  name: 'Podle pracoviště',
  description: 'Každé pracoviště má vlastní barvu',
  requiresDataset: false,
  requiresColumn: false,
  supportsColumn: () => false,
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const palette = context.theme.workplacePalette
    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue
      const workplace = context.workplaces.find((item) => item.id === workplaceId)
      colors[district.id] = {
        fill: colorFromPalette(palette, workplace?.name ?? workplaceId),
      }
    }
    return colors
  },
  buildLegend: (context) => ({
    title: 'Pracoviště OPŽL',
    items: context.workplaces.map((workplace) => ({
      id: workplace.id,
      label: workplace.name,
      color: colorFromPalette(context.theme.workplacePalette, workplace.name),
    })),
  }),
}
