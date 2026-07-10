import { resolveRegionDisplayColor } from '../../color/regionDisplayColors'
import type { VisualizationPlugin } from '../types'
import {
  createEmptyColorMap,
  getRegionalOfficeForWorkplace,
  getWorkplaceForDistrict,
} from '../contextUtils'

export const byRegionalOfficePlugin: VisualizationPlugin = {
  id: 'by-regional-office',
  name: 'Podle regionálního odboru',
  description: 'Obarvení podle regionálního odboru',
  requiresDataset: false,
  requiresColumn: false,
  supportsColumn: () => false,
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const overrides = context.regionDisplayColors ?? {}

    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue

      const regionalOfficeId = getRegionalOfficeForWorkplace(context, workplaceId)
      if (!regionalOfficeId) continue

      const office = context.regionalOffices.find((item) => item.id === regionalOfficeId)
      colors[district.id] = {
        fill: resolveRegionDisplayColor(
          regionalOfficeId,
          office?.name ?? regionalOfficeId,
          overrides,
        ),
      }
    }

    return colors
  },
  buildLegend: (context) => {
    const overrides = context.regionDisplayColors ?? {}
    return {
      title: 'Regionální odbory',
      items: context.regionalOffices.map((office) => ({
        id: office.id,
        label: office.name,
        color: resolveRegionDisplayColor(office.id, office.name, overrides),
      })),
    }
  },
}
