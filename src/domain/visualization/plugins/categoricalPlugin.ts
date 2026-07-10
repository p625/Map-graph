import type { VisualizationPlugin } from '../types'
import { colorFromPalette } from '../colorUtils'
import { createEmptyColorMap, getRecordForDistrict } from '../contextUtils'

export const categoricalPlugin: VisualizationPlugin = {
  id: 'categorical',
  name: 'Kategorická mapa',
  description: 'Obarvení podle textové hodnoty vybraného sloupce',
  requiresDataset: true,
  requiresColumn: true,
  supportsColumn: (column) => column.type === 'text',
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const columnKey = context.column?.key
    const palette = context.theme.categoricalPalette
    const noData = context.theme.noDataFill

    for (const district of context.districts) {
      const record = getRecordForDistrict(context, district.id)
      const raw = columnKey ? record?.values[columnKey] : null
      const label = raw === null || raw === undefined || raw === '' ? null : String(raw)

      colors[district.id] = {
        fill: label ? colorFromPalette(palette, label) : noData,
      }
    }

    return colors
  },
  buildLegend: (context) => {
    const columnKey = context.column?.key
    const labels = new Set<string>()
    let hasNoData = false

    for (const district of context.districts) {
      const record = getRecordForDistrict(context, district.id)
      const raw = columnKey ? record?.values[columnKey] : null
      if (raw === null || raw === undefined || raw === '') {
        hasNoData = true
      } else {
        labels.add(String(raw))
      }
    }

    const items = [...labels].sort().map((label) => ({
      id: label,
      label,
      color: colorFromPalette(context.theme.categoricalPalette, label),
    }))

    if (hasNoData) {
      items.push({
        id: '__no_data__',
        label: 'Bez dat',
        color: context.theme.noDataFill,
      })
    }

    return {
      title: context.column?.name ?? 'Kategorie',
      items,
    }
  },
}
