import type { OrganizationLegendItem, OrganizationLegendLabelMode } from './organizationLegend'

export interface OrganizationLegendLayout {
  xPercent: number
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

export const DEFAULT_ORGANIZATION_LEGEND_LAYOUT: OrganizationLegendLayout = {
  xPercent: 58,
  yPercent: 2,
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

export function sanitizeOrganizationLegendLayout(
  value: Partial<OrganizationLegendLayout> | null | undefined,
): OrganizationLegendLayout {
  if (!value) return DEFAULT_ORGANIZATION_LEGEND_LAYOUT
  return {
    xPercent: clamp(value.xPercent, 0, 95, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xPercent),
    yPercent: clamp(value.yPercent, 0, 95, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yPercent),
    width: clamp(value.width, 120, 600, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.width),
    height: clamp(value.height, 80, 500, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.height),
    fontSizePx: clamp(value.fontSizePx, 6, 18, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.fontSizePx),
    itemGapPx: clamp(value.itemGapPx, 0, 16, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.itemGapPx),
    columnGapPx: clamp(value.columnGapPx, 4, 32, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.columnGapPx),
    rowGapPx: clamp(value.rowGapPx, 0, 16, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.rowGapPx),
    maxColumns: clamp(value.maxColumns, 1, 6, DEFAULT_ORGANIZATION_LEGEND_LAYOUT.maxColumns),
    backgroundMode: value.backgroundMode === 'light' ? 'light' : 'transparent',
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(max, Math.max(min, parsed)))
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
  containerWidth: number,
  containerHeight: number,
): OrganizationLegendLayout {
  const maxWidth = Math.max(120, containerWidth - 8)
  const maxHeight = Math.max(80, containerHeight - 8)
  const x = Math.min(
    (layout.xPercent / 100) * containerWidth,
    containerWidth - Math.min(layout.width, maxWidth),
  )
  const y = Math.min(
    (layout.yPercent / 100) * containerHeight,
    containerHeight - Math.min(layout.height, maxHeight),
  )
  return {
    ...layout,
    xPercent: containerWidth > 0 ? (x / containerWidth) * 100 : layout.xPercent,
    yPercent: containerHeight > 0 ? (y / containerHeight) * 100 : layout.yPercent,
    width: Math.min(layout.width, maxWidth),
    height: Math.min(layout.height, maxHeight),
  }
}
