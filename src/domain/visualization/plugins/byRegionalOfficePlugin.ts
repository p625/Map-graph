import type { VisualizationPlugin } from '../types'
import { colorFromPalette } from '../colorUtils'
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
    const palette = context.theme.regionalPalette

    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue

      const regionalOfficeId = getRegionalOfficeForWorkplace(context, workplaceId)
      if (!regionalOfficeId) continue

      const office = context.regionalOffices.find((item) => item.id === regionalOfficeId)
      colors[district.id] = {
        fill: colorFromPalette(palette, office?.name ?? regionalOfficeId),
      }
    }

    return colors
  },
  buildLegend: (context) => ({
    title: 'Regionální odbory',
    items: context.regionalOffices.map((office) => ({
      id: office.id,
      label: office.name,
      color: colorFromPalette(context.theme.regionalPalette, office.name),
    })),
  }),
}
