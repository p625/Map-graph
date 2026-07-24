import type { OrganizationLegendLayout } from './organizationLegendLayout'
import { DEFAULT_ORGANIZATION_LEGEND_LAYOUT } from './organizationLegendLayout'

export const LEGEND_CONTENT_SCALE_MIN = 0.5
export const LEGEND_CONTENT_SCALE_MAX = 2.5
export const LEGEND_CONTENT_SCALE_DEFAULT = 1

export interface OrganizationalLegendStyleTokens {
  titleFontSize: number
  itemFontSize: number
  secondaryFontSize: number
  lineHeight: number
  markerSize: number
  markerBorderWidth: number
  itemGap: number
  markerTextGap: number
  columnGap: number
  rowGap: number
  sectionGap: number
  paddingX: number
  paddingY: number
  borderRadius: number
  borderWidth: number
  maxColumns: number
  backgroundMode: 'transparent' | 'light'
}

export function extractLegendStyleTokens(
  layout: Pick<
    OrganizationLegendLayout,
    | 'fontSizePx'
    | 'itemGapPx'
    | 'columnGapPx'
    | 'rowGapPx'
    | 'maxColumns'
    | 'backgroundMode'
  >,
): OrganizationalLegendStyleTokens {
  const itemFontSize = layout.fontSizePx
  return {
    titleFontSize: itemFontSize + 1,
    itemFontSize,
    secondaryFontSize: Math.max(6, itemFontSize - 1),
    lineHeight: 1.35,
    markerSize: Math.max(8, itemFontSize),
    markerBorderWidth: 1,
    itemGap: layout.itemGapPx,
    markerTextGap: 6,
    columnGap: layout.columnGapPx,
    rowGap: layout.rowGapPx,
    sectionGap: layout.rowGapPx + layout.itemGapPx,
    paddingX: 6,
    paddingY: 6,
    borderRadius: 2,
    borderWidth: 1,
    maxColumns: layout.maxColumns,
    backgroundMode: layout.backgroundMode,
  }
}

export const DEFAULT_LEGEND_STYLE_TOKENS = extractLegendStyleTokens(
  DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
)

function scaleNumber(value: number, scale: number, min = 0): number {
  return Math.max(min, Math.round(value * scale * 100) / 100)
}

export function scaleLegendStyleTokens(
  base: OrganizationalLegendStyleTokens,
  scale: number,
): OrganizationalLegendStyleTokens {
  const safeScale = clampContentScale(scale)
  return {
    titleFontSize: scaleNumber(base.titleFontSize, safeScale, 6),
    itemFontSize: scaleNumber(base.itemFontSize, safeScale, 6),
    secondaryFontSize: scaleNumber(base.secondaryFontSize, safeScale, 5),
    lineHeight: base.lineHeight,
    markerSize: scaleNumber(base.markerSize, safeScale, 6),
    markerBorderWidth: Math.max(0.5, scaleNumber(base.markerBorderWidth, safeScale, 0.5)),
    itemGap: scaleNumber(base.itemGap, safeScale, 0),
    markerTextGap: scaleNumber(base.markerTextGap, safeScale, 2),
    columnGap: scaleNumber(base.columnGap, safeScale, 2),
    rowGap: scaleNumber(base.rowGap, safeScale, 0),
    sectionGap: scaleNumber(base.sectionGap, safeScale, 0),
    paddingX: scaleNumber(base.paddingX, safeScale, 2),
    paddingY: scaleNumber(base.paddingY, safeScale, 2),
    borderRadius: scaleNumber(base.borderRadius, safeScale, 1),
    borderWidth: Math.max(0.5, scaleNumber(base.borderWidth, safeScale, 0.5)),
    maxColumns: base.maxColumns,
    backgroundMode: base.backgroundMode,
  }
}

export function clampContentScale(value: unknown, fallback = LEGEND_CONTENT_SCALE_DEFAULT): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(
    LEGEND_CONTENT_SCALE_MAX,
    Math.max(LEGEND_CONTENT_SCALE_MIN, Math.round(parsed * 100) / 100),
  )
}

export function layoutStyleFromTokens(
  tokens: OrganizationalLegendStyleTokens,
  width: number,
  height: number,
  ratios: Pick<
    OrganizationLegendLayout,
    'xRatio' | 'yRatio' | 'widthRatio' | 'heightRatio'
  >,
): OrganizationLegendLayout {
  return {
    xRatio: ratios.xRatio,
    yRatio: ratios.yRatio,
    widthRatio: ratios.widthRatio,
    heightRatio: ratios.heightRatio,
    xPercent: Math.round(ratios.xRatio * 100),
    yPercent: Math.round(ratios.yRatio * 100),
    width,
    height,
    fontSizePx: tokens.itemFontSize,
    itemGapPx: tokens.itemGap,
    columnGapPx: tokens.columnGap,
    rowGapPx: tokens.rowGap,
    maxColumns: tokens.maxColumns,
    backgroundMode: tokens.backgroundMode,
  }
}
