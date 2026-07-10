import { resolveWorkplaceDisplayColor } from '../../color/workplaceDisplayColors'
import type { VisualizationPlugin } from '../types'
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
    const overrides = context.workplaceDisplayColors ?? {}
    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue
      const workplace = context.workplaces.find((item) => item.id === workplaceId)
      colors[district.id] = {
        fill: resolveWorkplaceDisplayColor(
          workplaceId,
          workplace?.name ?? workplaceId,
          overrides,
        ),
      }
    }
    return colors
  },
  buildLegend: (context) => {
    const overrides = context.workplaceDisplayColors ?? {}
    return {
      title: 'Pracoviště OPŽL',
      items: context.workplaces.map((workplace) => ({
        id: workplace.id,
        label: workplace.name,
        color: resolveWorkplaceDisplayColor(workplace.id, workplace.name, overrides),
      })),
    }
  },
}
