import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../map/mapViewport'
import type { OrganizationLegendItem, OrganizationLegendLabelMode } from './organizationLegend'

export const LEGEND_EDGE_PADDING_PX = 12

export interface OrganizationalLegendRatioLayout {
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export interface OrganizationLegendLayout extends OrganizationalLegendRatioLayout {
  /** @deprecated Synced from xRatio for backward compatibility. */
  xPercent: number
  /** @deprecated Synced from yRatio for backward compatibility. */
  yPercent: number
  width: number
  height: number
  fontSizePx: number
  itemGapPx: number
  columnGapPx: number
  rowGapPx: number
  maxColumns: number
  backgroundMode: 'transparent' | 'light'
}

export interface LegendViewportBounds {
  viewportWidth: number
  viewportHeight: number
  legendWidth: number
  legendHeight: number
}

export interface LegendMovementBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  availableWidth: number
  availableHeight: number
}

export const DEFAULT_ORGANIZATION_LEGEND_LAYOUT: OrganizationLegendLayout = {
  xRatio: 0.94,
  yRatio: 0,
  widthRatio: 280 / MAP_LOGICAL_WIDTH,
  heightRatio: 220 / MAP_LOGICAL_HEIGHT,
  xPercent: 94,
  yPercent: 0,
  width: 280,
  height: 220,
  fontSizePx: 9,
  itemGapPx: 4,
  columnGapPx: 14,
  rowGapPx: 2,
  maxColumns: 4,
  backgroundMode: 'transparent',
}

export interface OrganizationLegendSegment {
  designation: string
  leaderName: string
  showDesignation: boolean
  showLeader: boolean
  showCount: boolean
  workplaceCount: number
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(max, Math.max(min, parsed)))
}

function clampRatio(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

export function computeLegendMovementBounds(input: LegendViewportBounds): LegendMovementBounds {
  const minX = LEGEND_EDGE_PADDING_PX
  const minY = LEGEND_EDGE_PADDING_PX
  const maxX = Math.max(
    minX,
    input.viewportWidth - input.legendWidth - LEGEND_EDGE_PADDING_PX,
  )
  const maxY = Math.max(
    minY,
    input.viewportHeight - input.legendHeight - LEGEND_EDGE_PADDING_PX,
  )
  return {
    minX,
    minY,
    maxX,
    maxY,
    availableWidth: Math.max(0, maxX - minX),
    availableHeight: Math.max(0, maxY - minY),
  }
}

export function legendPositionFromRatios(
  layout: Pick<OrganizationLegendLayout, 'xRatio' | 'yRatio'>,
  bounds: LegendViewportBounds,
): { x: number; y: number } {
  const movement = computeLegendMovementBounds(bounds)
  return {
    x: movement.minX + layout.xRatio * movement.availableWidth,
    y: movement.minY + layout.yRatio * movement.availableHeight,
  }
}

export function legendRatiosFromPosition(
  x: number,
  y: number,
  bounds: LegendViewportBounds,
): { xRatio: number; yRatio: number } {
  const movement = computeLegendMovementBounds(bounds)
  const clampedX = Math.min(movement.maxX, Math.max(movement.minX, x))
  const clampedY = Math.min(movement.maxY, Math.max(movement.minY, y))
  return {
    xRatio:
      movement.availableWidth > 0
        ? (clampedX - movement.minX) / movement.availableWidth
        : 0,
    yRatio:
      movement.availableHeight > 0
        ? (clampedY - movement.minY) / movement.availableHeight
        : 0,
  }
}

function migrateLegacyPercentPosition(
  value: Partial<OrganizationLegendLayout>,
  viewportWidth: number,
  viewportHeight: number,
): { xRatio: number; yRatio: number } {
  const width = clampNumber(
    value.width,
    120,
    600,
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT.width,
  )
  const height = clampNumber(
    value.height,
    80,
    500,
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT.height,
  )
  const xPercent =
    typeof value.xPercent === 'number'
      ? value.xPercent
      : DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xPercent
  const yPercent =
    typeof value.yPercent === 'number'
      ? value.yPercent
      : DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yPercent
  const legacyX = (xPercent / 100) * viewportWidth
  const legacyY = (yPercent / 100) * viewportHeight
  return legendRatiosFromPosition(legacyX, legacyY, {
    viewportWidth,
    viewportHeight,
    legendWidth: width,
    legendHeight: height,
  })
}

export function sanitizeOrganizationLegendLayout(
  value: Partial<OrganizationLegendLayout> | null | undefined,
  viewportWidth = 760,
  viewportHeight = 460,
): OrganizationLegendLayout {
  if (!value) return DEFAULT_ORGANIZATION_LEGEND_LAYOUT

  const width = clampNumber(value.width, 120, 600, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.width)
  const height = clampNumber(value.height, 80, 500, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.height)

  const hasPositionRatios =
    typeof value.xRatio === 'number' &&
    Number.isFinite(value.xRatio) &&
    typeof value.yRatio === 'number' &&
    Number.isFinite(value.yRatio)

  const positionRatios = hasPositionRatios
    ? {
        xRatio: clampRatio(value.xRatio, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio),
        yRatio: clampRatio(value.yRatio, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yRatio),
      }
    : migrateLegacyPercentPosition(value, viewportWidth, viewportHeight)

  const widthRatio = clampRatio(
    value.widthRatio ??
      (viewportWidth > 0 ? width / viewportWidth : DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio),
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio,
  )
  const heightRatio = clampRatio(
    value.heightRatio ??
      (viewportHeight > 0 ? height / viewportHeight : DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio),
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio,
  )

  const clamped = clampLegendLayoutToBounds(
    {
      ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
      ...value,
      width,
      height,
      xRatio: positionRatios.xRatio,
      yRatio: positionRatios.yRatio,
      widthRatio,
      heightRatio,
    },
    viewportWidth,
    viewportHeight,
  )

  return clamped
}

export function resolveOrganizationLegendSegments(
  item: OrganizationLegendItem,
  mode: OrganizationLegendLabelMode,
  showWorkplaceCount: boolean,
): OrganizationLegendSegment {
  return {
    designation: item.orgUnitDesignation,
    leaderName: item.leaderName,
    showDesignation: mode === 'org-unit' || mode === 'leader-org-unit',
    showLeader: mode === 'leader' || mode === 'leader-org-unit',
    showCount: showWorkplaceCount,
    workplaceCount: item.workplaceCount,
  }
}

export function estimateLegendItemWidth(
  segment: OrganizationLegendSegment,
  fontSizePx: number,
): number {
  const swatch = Math.max(8, fontSizePx)
  const charWidth = fontSizePx * 0.52
  let textWidth = swatch + 6
  if (segment.showDesignation && segment.designation) {
    textWidth += segment.designation.length * charWidth + 8
  }
  if (segment.showLeader && segment.leaderName) {
    textWidth += segment.leaderName.length * charWidth + 4
  }
  if (segment.showCount) {
    textWidth += `(${segment.workplaceCount})`.length * charWidth
  }
  return Math.max(72, textWidth + 8)
}

export function computeAutoColumnCount(
  layout: OrganizationLegendLayout,
  items: OrganizationLegendItem[],
  mode: OrganizationLegendLabelMode,
  showWorkplaceCount: boolean,
): number {
  if (items.length === 0) return 1

  const segments = items.map((item) =>
    resolveOrganizationLegendSegments(item, mode, showWorkplaceCount),
  )
  const maxItemWidth = Math.max(
    ...segments.map((segment) => estimateLegendItemWidth(segment, layout.fontSizePx)),
  )
  const estimatedItemWidth = maxItemWidth + layout.itemGapPx

  const columns = Math.floor((layout.width + layout.columnGapPx) / estimatedItemWidth)
  return Math.max(1, Math.min(layout.maxColumns, columns))
}

export function distributeItemsRowMajor<T>(items: T[], columnCount: number): T[] {
  const columns = Math.max(1, columnCount)
  const rows = Math.ceil(items.length / columns)
  const grid: T[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col
      if (index < items.length) grid.push(items[index])
    }
  }
  return grid
}

export function clampLegendLayoutToBounds(
  layout: OrganizationLegendLayout,
  viewportWidth: number,
  viewportHeight: number,
): OrganizationLegendLayout {
  const maxWidth = Math.max(120, viewportWidth - LEGEND_EDGE_PADDING_PX * 2)
  const maxHeight = Math.max(80, viewportHeight - LEGEND_EDGE_PADDING_PX * 2)
  const width = Math.min(layout.width, maxWidth)
  const height = Math.min(layout.height, maxHeight)

  const bounds: LegendViewportBounds = {
    viewportWidth,
    viewportHeight,
    legendWidth: width,
    legendHeight: height,
  }

  const { x, y } = legendPositionFromRatios(layout, bounds)
  const ratios = legendRatiosFromPosition(x, y, bounds)

  return {
    ...layout,
    width,
    height,
    xRatio: ratios.xRatio,
    yRatio: ratios.yRatio,
    widthRatio: viewportWidth > 0 ? width / viewportWidth : layout.widthRatio,
    heightRatio: viewportHeight > 0 ? height / viewportHeight : layout.heightRatio,
    xPercent: Math.round(ratios.xRatio * 100),
    yPercent: Math.round(ratios.yRatio * 100),
  }
}

export function resetOrganizationLegendPosition(
  layout: OrganizationLegendLayout,
  viewportWidth: number,
  viewportHeight: number,
): OrganizationLegendLayout {
  return clampLegendLayoutToBounds(
    {
      ...layout,
      xRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio,
      yRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yRatio,
    },
    viewportWidth,
    viewportHeight,
  )
}
