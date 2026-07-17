import type { VisualizationPlugin } from '../types'
import { interpolateColorWithStops } from '../../color-themes/colorInterpolation'
import { interpolateColor } from '../colorUtils'
import {
  createEmptyColorMap,
  getNumericColumnValue,
  getRecordForDistrict,
  getScopedDistricts,
} from '../contextUtils'

export const choroplethPlugin: VisualizationPlugin = {
  id: 'choropleth',
  name: 'Barevná škála',
  description: 'Obarvení podle číselné hodnoty vybraného sloupce',
  requiresDataset: true,
  requiresColumn: true,
  supportsColumn: (column) => column.type === 'number' || column.type === 'percent',
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const columnKey = context.column?.key
    const scale = context.theme.sequentialScale
    const colorStops = context.theme.colorStops
    const noData = context.theme.noDataFill
    const scopedDistricts = getScopedDistricts(context)
    const values: number[] = []

    for (const district of scopedDistricts) {
      const record = getRecordForDistrict(context, district.id)
      const value = getNumericColumnValue(record, columnKey)
      if (value !== null) values.push(value)
    }

    const min = values.length > 0 ? Math.min(...values) : 0
    const max = values.length > 0 ? Math.max(...values) : 0

    for (const district of context.districts) {
      const record = getRecordForDistrict(context, district.id)
      const value = getNumericColumnValue(record, columnKey)
      colors[district.id] = {
        fill:
          value === null
            ? noData
            : colorStops
              ? interpolateColorWithStops(min, max, value, colorStops)
              : interpolateColor(min, max, value, scale),
      }
    }

    return colors
  },
  buildLegend: (context) => {
    const columnKey = context.column?.key
    const scopedDistricts = getScopedDistricts(context)
    const values = scopedDistricts
      .map((district) => getNumericColumnValue(getRecordForDistrict(context, district.id), columnKey))
      .filter((value): value is number => value !== null)

    const min = values.length > 0 ? Math.min(...values) : 0
    const max = values.length > 0 ? Math.max(...values) : 0

    return {
      title: context.column?.name ?? 'Barevná škála',
      items: [],
      scale: {
        min,
        max,
        colors: context.theme.sequentialScale,
      },
    }
  },
}
