export type MapSizeMode = 'maximum' | 'balanced' | 'custom'

export interface ExportMapSizing {
  mode: MapSizeMode
  /** Použito v režimu custom — podíl mapové plochy na celkovém výstupu (50–100). */
  mapAreaPercent: number
}

export const DEFAULT_EXPORT_MAP_SIZING: ExportMapSizing = {
  mode: 'maximum',
  mapAreaPercent: 85,
}

export const BALANCED_EXPORT_MAP_SIZING: ExportMapSizing = {
  mode: 'balanced',
  mapAreaPercent: 78,
}

export interface ExportLayoutInput {
  width: number
  height: number
  showLegend: boolean
  showDatasetInfo: boolean
  title: string
  subtitle: string
  sizing?: ExportMapSizing
}

export interface ExportLayoutMetrics {
  padding: number
  headerHeight: number
  footerHeight: number
  legendWidth: number
  mapWidth: number
  mapHeight: number
  mapAreaRatio: number
  mapOnly: boolean
}

function buildLayoutMetrics(
  input: ExportLayoutInput,
  metrics: Omit<ExportLayoutMetrics, 'mapAreaRatio' | 'mapOnly'>,
): ExportLayoutMetrics {
  const hasHeader = Boolean(input.title.trim() || input.subtitle.trim())
  const mapOnly = !input.showLegend && !input.showDatasetInfo && !hasHeader
  const totalArea = input.width * input.height
  const mapArea = Math.max(0, metrics.mapWidth) * Math.max(0, metrics.mapHeight)
  return {
    ...metrics,
    mapAreaRatio: totalArea > 0 ? mapArea / totalArea : 0,
    mapOnly,
  }
}

export function computeExportLayout(input: ExportLayoutInput): ExportLayoutMetrics {
  const sizing = input.sizing ?? DEFAULT_EXPORT_MAP_SIZING
  const hasHeader = Boolean(input.title.trim() || input.subtitle.trim())
  const mapOnly = !input.showLegend && !input.showDatasetInfo && !hasHeader
  const totalArea = input.width * input.height

  if (mapOnly || sizing.mode === 'maximum') {
    const padding = Math.max(6, Math.round(input.width * 0.008))
    const headerHeight = hasHeader ? Math.round(input.height * 0.06) : 0
    const footerHeight = 0
    const contentHeight = input.height - headerHeight - padding * (hasHeader ? 1.5 : 2)
    const mapWidth = input.width - padding * 2
    const mapHeight = contentHeight

    return buildLayoutMetrics(input, {
      padding,
      headerHeight,
      footerHeight,
      legendWidth: 0,
      mapWidth: Math.max(0, mapWidth),
      mapHeight: Math.max(0, mapHeight),
    })
  }

  if (sizing.mode === 'balanced') {
    const padding = Math.round(input.width * 0.015)
    const headerHeight = hasHeader ? Math.round(input.height * 0.06) : 0
    const footerHeight = input.showDatasetInfo ? Math.round(input.height * 0.015) : 0
    const contentHeight = input.height - headerHeight - footerHeight - padding * 2
    const mapWidth = input.width - padding * 2
    const mapHeight = contentHeight

    return buildLayoutMetrics(input, {
      padding,
      headerHeight,
      footerHeight,
      legendWidth: 0,
      mapWidth: Math.max(0, mapWidth),
      mapHeight: Math.max(0, mapHeight),
    })
  }

  const mapAreaPercent = Math.min(100, Math.max(50, sizing.mapAreaPercent))
  const targetMapArea = totalArea * (mapAreaPercent / 100)
  const padding = Math.max(8, Math.round(input.width * 0.012))
  const headerHeight = hasHeader ? Math.round(input.height * 0.055) : 0
  const footerHeight = input.showDatasetInfo ? Math.round(input.height * 0.025) : 0
  const contentWidth = input.width - padding * 2
  const contentHeight = input.height - headerHeight - footerHeight - padding * 2

  let mapHeight = Math.max(0, contentHeight)
  let mapWidth = contentWidth

  if (mapHeight > 0 && contentWidth > 0) {
    mapWidth = Math.min(contentWidth, Math.ceil(targetMapArea / mapHeight))
  }

  return buildLayoutMetrics(input, {
    padding,
    headerHeight,
    footerHeight,
    legendWidth: 0,
    mapWidth,
    mapHeight,
  })
}
