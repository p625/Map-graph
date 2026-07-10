import { resolveDistrictDisplayColor } from '../../color/districtDisplayColors'
import type { VisualizationPlugin } from '../types'
import { createEmptyColorMap } from '../contextUtils'

export const byDistrictPlugin: VisualizationPlugin = {
  id: 'by-district',
  name: 'Podle okresů',
  description: 'Samostatné obarvení každého okresního polygonu',
  requiresDataset: false,
  requiresColumn: false,
  requiresOrganization: false,
  districtInteraction: true,
  supportsColumn: () => false,
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const overrides = context.districtDisplayColors ?? {}

    for (const district of context.districts) {
      colors[district.id] = {
        fill: resolveDistrictDisplayColor(district.id, district.name, overrides),
      }
    }

    return colors
  },
  buildLegend: (context) => ({
    title: 'Okresy',
    items: [...context.districts]
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      .map((district) => ({
        id: district.id,
        label: district.name,
        color: resolveDistrictDisplayColor(
          district.id,
          district.name,
          context.districtDisplayColors ?? {},
        ),
      })),
  }),
}
