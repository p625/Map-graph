import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../map/mapViewport'
import type { OrganizationLegendLayout } from './organizationLegendLayout'
import {
  clampLegendLayoutToBounds,
  DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
  type OrganizationalLegendRatioLayout,
} from './organizationLegendLayout'

export interface MapContentRect {
  width: number
  height: number
}

export interface OrganizationLegendExportState {
  inheritFromEditor: boolean
  layout: OrganizationalLegendRatioLayout | null
}

export const DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE: OrganizationLegendExportState = {
  inheritFromEditor: true,
  layout: null,
}

export function extractOrganizationalLegendRatioLayout(
  layout: OrganizationLegendLayout,
): OrganizationalLegendRatioLayout {
  return {
    xRatio: layout.xRatio,
    yRatio: layout.yRatio,
    widthRatio: layout.widthRatio,
    heightRatio: layout.heightRatio,
  }
}

export function resolveLegendLayoutForMapArea(
  ratios: OrganizationalLegendRatioLayout,
  mapRect: MapContentRect,
  style: Pick<
    OrganizationLegendLayout,
    | 'fontSizePx'
    | 'itemGapPx'
    | 'columnGapPx'
    | 'rowGapPx'
    | 'maxColumns'
    | 'backgroundMode'
  >,
): OrganizationLegendLayout {
  const minWidth = Math.max(120, Math.round(mapRect.width * 0.12))
  const maxWidth = Math.max(minWidth, Math.round(mapRect.width * 0.6))
  const minHeight = Math.max(80, Math.round(mapRect.height * 0.1))
  const maxHeight = Math.max(minHeight, Math.round(mapRect.height * 0.6))

  const width = Math.min(
    maxWidth,
    Math.max(minWidth, Math.round(ratios.widthRatio * mapRect.width)),
  )
  const height = Math.min(
    maxHeight,
    Math.max(minHeight, Math.round(ratios.heightRatio * mapRect.height)),
  )

  return clampLegendLayoutToBounds(
    {
      ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
      ...style,
      ...ratios,
      width,
      height,
    },
    mapRect.width,
    mapRect.height,
  )
}

export function resolveExportOrganizationLegendLayout(
  editorLayout: OrganizationLegendLayout,
  exportState: OrganizationLegendExportState,
  mapRect: MapContentRect,
  style: Pick<
    OrganizationLegendLayout,
    | 'fontSizePx'
    | 'itemGapPx'
    | 'columnGapPx'
    | 'rowGapPx'
    | 'maxColumns'
    | 'backgroundMode'
  >,
): OrganizationLegendLayout {
  const ratios =
    exportState.inheritFromEditor || !exportState.layout
      ? extractOrganizationalLegendRatioLayout(editorLayout)
      : exportState.layout

  return resolveLegendLayoutForMapArea(ratios, mapRect, style)
}

export function resetExportOrganizationLegendLayout(
  style: Pick<
    OrganizationLegendLayout,
    | 'fontSizePx'
    | 'itemGapPx'
    | 'columnGapPx'
    | 'rowGapPx'
    | 'maxColumns'
    | 'backgroundMode'
  >,
  mapRect: MapContentRect,
): OrganizationLegendLayout {
  return resolveLegendLayoutForMapArea(
    extractOrganizationalLegendRatioLayout(DEFAULT_ORGANIZATION_LEGEND_LAYOUT),
    mapRect,
    style,
  )
}

export function sanitizeOrganizationLegendExportState(
  value: Partial<OrganizationLegendExportState> | null | undefined,
): OrganizationLegendExportState {
  if (!value) return DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE

  const layout =
    value.layout &&
    typeof value.layout.xRatio === 'number' &&
    typeof value.layout.yRatio === 'number' &&
    typeof value.layout.widthRatio === 'number' &&
    typeof value.layout.heightRatio === 'number'
      ? {
          xRatio: clampRatio(value.layout.xRatio, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio),
          yRatio: clampRatio(value.layout.yRatio, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yRatio),
          widthRatio: clampRatio(
            value.layout.widthRatio,
            DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio,
          ),
          heightRatio: clampRatio(
            value.layout.heightRatio,
            DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio,
          ),
        }
      : null

  return {
    inheritFromEditor: value.inheritFromEditor !== false,
    layout,
  }
}

function clampRatio(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

export function editorReferenceMapRect(): MapContentRect {
  return {
    width: MAP_LOGICAL_WIDTH,
    height: MAP_LOGICAL_HEIGHT,
  }
}
