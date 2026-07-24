import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../map/mapViewport'
import {
  clampContentScale,
  LEGEND_CONTENT_SCALE_DEFAULT,
} from '../organization/organizationLegendStyle'
import type { OrganizationalLegendRatioLayout } from '../organization/organizationLegendLayout'
import { DEFAULT_ORGANIZATION_LEGEND_LAYOUT } from '../organization/organizationLegendLayout'

export type ExportCompositionPresetId =
  | 'map-full'
  | 'map-right-legend-left'
  | 'map-top-right'
  | 'custom'

export type ExportCompositionSelection = 'map' | 'title' | 'legend' | null

export interface ExportRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ExportTitleLayout {
  visible: boolean
  text: string
  xRatio: number
  yRatio: number
  widthRatio: number
  fontSize: number
  fontWeight: number
  textAlign: 'left' | 'center' | 'right'
}

export interface ExportMapElementLayout {
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
  preserveAspectRatio: boolean
}

export interface ExportOrganizationalLegendLayout {
  visible: boolean
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
  contentScale: number
  inheritPositionFromEditor: boolean
  inheritSizeFromEditor: boolean
}

export interface ExportCompositionLayout {
  presetId: ExportCompositionPresetId
  title: ExportTitleLayout
  map: ExportMapElementLayout
  organizationalLegend: ExportOrganizationalLegendLayout
}

export interface ExportCompositionLayoutPatch {
  presetId?: ExportCompositionPresetId
  title?: Partial<ExportTitleLayout>
  map?: Partial<ExportMapElementLayout>
  organizationalLegend?: Partial<ExportOrganizationalLegendLayout>
}

export interface ExportRenderContext {
  canvasWidth: number
  canvasHeight: number
  previewScale?: number
  composition: ExportCompositionLayout
}

export const EXPORT_CANVAS_PADDING_PX = 12

export interface LegacySplitExportLayoutFields {
  divider?: boolean
  legendPanelWidth?: number
  reservedLegendWidth?: number
  splitLayout?: boolean
  mapColumnWidth?: number
  legendColumnWidth?: number
  dividerX?: number
}

export function computeExportContentRect(
  canvasWidth: number,
  canvasHeight: number,
): ExportRect {
  return {
    x: EXPORT_CANVAS_PADDING_PX,
    y: EXPORT_CANVAS_PADDING_PX,
    width: Math.max(0, canvasWidth - EXPORT_CANVAS_PADDING_PX * 2),
    height: Math.max(0, canvasHeight - EXPORT_CANVAS_PADDING_PX * 2),
  }
}

export const DEFAULT_EXPORT_COMPOSITION_LAYOUT: ExportCompositionLayout = {
  presetId: 'map-full',
  title: {
    visible: true,
    text: '',
    xRatio: 0,
    yRatio: 0,
    widthRatio: 1,
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'left',
  },
  map: {
    xRatio: 0,
    yRatio: 0,
    widthRatio: 1,
    heightRatio: 1,
    preserveAspectRatio: true,
  },
  organizationalLegend: {
    visible: true,
    xRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio,
    yRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yRatio,
    widthRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio,
    heightRatio: DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio,
    contentScale: LEGEND_CONTENT_SCALE_DEFAULT,
    inheritPositionFromEditor: true,
    inheritSizeFromEditor: true,
  },
}

function clampRatio(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(max, Math.max(min, parsed)))
}

export function computeAvailableRect(
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const content = computeExportContentRect(canvasWidth, canvasHeight)
  const minX = content.x
  const minY = content.y
  const maxX = Math.max(minX, content.x + content.width - elementWidth)
  const maxY = Math.max(minY, content.y + content.height - elementHeight)
  return { minX, minY, maxX, maxY }
}

export function resolveRectFromRatios(
  canvasWidth: number,
  canvasHeight: number,
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
): ExportRect {
  const content = computeExportContentRect(canvasWidth, canvasHeight)
  const width = Math.max(40, Math.round(widthRatio * content.width))
  const height = Math.max(40, Math.round(heightRatio * content.height))
  const bounds = computeAvailableRect(canvasWidth, canvasHeight, width, height)
  const availableWidth = Math.max(0, bounds.maxX - bounds.minX)
  const availableHeight = Math.max(0, bounds.maxY - bounds.minY)
  const x = bounds.minX + xRatio * availableWidth
  const y = bounds.minY + yRatio * availableHeight
  return {
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
  }
}

export function resolveExportMapRect(
  ctx: Pick<ExportRenderContext, 'canvasWidth' | 'canvasHeight' | 'composition'>,
): ExportRect {
  const { map } = ctx.composition
  let rect = resolveRectFromRatios(
    ctx.canvasWidth,
    ctx.canvasHeight,
    map.xRatio,
    map.yRatio,
    map.widthRatio,
    map.heightRatio,
  )

  if (map.preserveAspectRatio) {
    const aspect = MAP_LOGICAL_WIDTH / MAP_LOGICAL_HEIGHT
    const heightFromWidth = rect.width / aspect
    const widthFromHeight = rect.height * aspect
    if (heightFromWidth <= rect.height) {
      rect = { ...rect, height: Math.round(heightFromWidth) }
    } else {
      rect = { ...rect, width: Math.round(widthFromHeight) }
    }
    const reclamped = clampRectToCanvas(ctx.canvasWidth, ctx.canvasHeight, rect)
    return reclamped
  }

  return clampRectToCanvas(ctx.canvasWidth, ctx.canvasHeight, rect)
}

export function resolveExportTitleRect(
  ctx: Pick<ExportRenderContext, 'canvasWidth' | 'canvasHeight' | 'composition'>,
): ExportRect {
  const { title } = ctx.composition
  const estimatedHeight = Math.max(24, Math.round(title.fontSize * 1.6))
  const rect = resolveRectFromRatios(
    ctx.canvasWidth,
    ctx.canvasHeight,
    title.xRatio,
    title.yRatio,
    title.widthRatio,
    estimatedHeight / ctx.canvasHeight,
  )
  return { ...rect, height: estimatedHeight }
}

export function resolveExportLegendRect(
  ctx: Pick<ExportRenderContext, 'canvasWidth' | 'canvasHeight' | 'composition'>,
  legendWidth: number,
  legendHeight: number,
): ExportRect {
  const { organizationalLegend } = ctx.composition
  const bounds = computeAvailableRect(
    ctx.canvasWidth,
    ctx.canvasHeight,
    legendWidth,
    legendHeight,
  )
  const availableWidth = Math.max(0, bounds.maxX - bounds.minX)
  const availableHeight = Math.max(0, bounds.maxY - bounds.minY)
  const x = bounds.minX + organizationalLegend.xRatio * availableWidth
  const y = bounds.minY + organizationalLegend.yRatio * availableHeight
  return clampRectToCanvas(ctx.canvasWidth, ctx.canvasHeight, {
    x: Math.round(x),
    y: Math.round(y),
    width: legendWidth,
    height: legendHeight,
  })
}

export function resolveLegendWidthForComposition(
  ctx: Pick<ExportRenderContext, 'canvasWidth' | 'composition'>,
): number {
  const contentWidth = Math.max(0, ctx.canvasWidth - EXPORT_CANVAS_PADDING_PX * 2)
  const minWidth = Math.max(120, Math.round(contentWidth * 0.12))
  const maxWidth = Math.max(minWidth, Math.round(contentWidth * 0.75))
  const width = Math.round(ctx.composition.organizationalLegend.widthRatio * contentWidth)
  return Math.min(maxWidth, Math.max(minWidth, width))
}

export function clampRectToCanvas(
  canvasWidth: number,
  canvasHeight: number,
  rect: ExportRect,
): ExportRect {
  const content = computeExportContentRect(canvasWidth, canvasHeight)
  const width = Math.min(rect.width, content.width)
  const height = Math.min(rect.height, content.height)
  const bounds = computeAvailableRect(canvasWidth, canvasHeight, width, height)
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, rect.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, rect.y)),
    width,
    height,
  }
}

export function rectRatiosFromPosition(
  canvasWidth: number,
  canvasHeight: number,
  rect: ExportRect,
): { xRatio: number; yRatio: number; widthRatio: number; heightRatio: number } {
  const content = computeExportContentRect(canvasWidth, canvasHeight)
  const bounds = computeAvailableRect(canvasWidth, canvasHeight, rect.width, rect.height)
  const availableWidth = Math.max(0, bounds.maxX - bounds.minX)
  const availableHeight = Math.max(0, bounds.maxY - bounds.minY)
  return {
    xRatio: availableWidth > 0 ? (rect.x - bounds.minX) / availableWidth : 0,
    yRatio: availableHeight > 0 ? (rect.y - bounds.minY) / availableHeight : 0,
    widthRatio: content.width > 0 ? rect.width / content.width : 0,
    heightRatio: content.height > 0 ? rect.height / content.height : 0,
  }
}

export function applyMapFullCanvasLayout(
  composition: ExportCompositionLayout,
): ExportCompositionLayout {
  return {
    ...composition,
    presetId: 'custom',
    map: {
      ...composition.map,
      xRatio: 0,
      yRatio: 0,
      widthRatio: 1,
      heightRatio: 1,
      preserveAspectRatio: true,
    },
  }
}

function hasLegacySplitFields(legacy: LegacySplitExportLayoutFields): boolean {
  return Boolean(
    legacy.divider ||
      legacy.splitLayout ||
      legacy.reservedLegendWidth ||
      legacy.legendPanelWidth ||
      legacy.legendColumnWidth ||
      legacy.mapColumnWidth ||
      legacy.dividerX,
  )
}

export function migrateLegacySplitExportLayout(
  legacy: Partial<ExportCompositionLayout> & LegacySplitExportLayoutFields,
): Partial<ExportCompositionLayout> {
  if (!hasLegacySplitFields(legacy)) return legacy

  const totalColumnWidth =
    (legacy.mapColumnWidth ?? 0) + (legacy.reservedLegendWidth ?? legacy.legendPanelWidth ?? 0)
  const legendColumnRatio =
    legacy.legendColumnWidth ??
    (totalColumnWidth > 0
      ? (legacy.reservedLegendWidth ?? legacy.legendPanelWidth ?? 0) / totalColumnWidth
      : 0.44)

  return {
    ...legacy,
    presetId: 'custom',
    map: {
      xRatio: Math.min(0.92, legendColumnRatio + 0.04),
      yRatio: legacy.map?.yRatio ?? 0.12,
      widthRatio: Math.max(0.2, 1 - legendColumnRatio - 0.08),
      heightRatio: legacy.map?.heightRatio ?? 0.82,
      preserveAspectRatio: legacy.map?.preserveAspectRatio !== false,
    },
    organizationalLegend: {
      visible: legacy.organizationalLegend?.visible !== false,
      xRatio: legacy.organizationalLegend?.xRatio ?? 0.04,
      yRatio: legacy.organizationalLegend?.yRatio ?? 0.14,
      widthRatio: legacy.organizationalLegend?.widthRatio ?? legendColumnRatio,
      heightRatio: legacy.organizationalLegend?.heightRatio ?? 0.78,
      contentScale: legacy.organizationalLegend?.contentScale ?? LEGEND_CONTENT_SCALE_DEFAULT,
      inheritPositionFromEditor: legacy.organizationalLegend?.inheritPositionFromEditor ?? false,
      inheritSizeFromEditor: legacy.organizationalLegend?.inheritSizeFromEditor ?? false,
    },
  }
}

export function getExportCompositionPreset(id: ExportCompositionPresetId): ExportCompositionLayout {
  switch (id) {
    case 'map-top-right':
      return {
        presetId: 'map-top-right',
        title: {
          visible: true,
          text: '',
          xRatio: 0.05,
          yRatio: 0.05,
          widthRatio: 0.55,
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'left',
        },
        map: {
          xRatio: 0.58,
          yRatio: 0.08,
          widthRatio: 0.37,
          heightRatio: 0.42,
          preserveAspectRatio: true,
        },
        organizationalLegend: {
          visible: true,
          xRatio: 0.05,
          yRatio: 0.18,
          widthRatio: 0.47,
          heightRatio: 0.55,
          contentScale: 1.2,
          inheritPositionFromEditor: false,
          inheritSizeFromEditor: false,
        },
      }
    case 'map-right-legend-left':
      return {
        presetId: 'map-right-legend-left',
        title: {
          visible: true,
          text: '',
          xRatio: 0.04,
          yRatio: 0.03,
          widthRatio: 0.55,
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'left',
        },
        map: {
          xRatio: 0.52,
          yRatio: 0.12,
          widthRatio: 0.44,
          heightRatio: 0.82,
          preserveAspectRatio: true,
        },
        organizationalLegend: {
          visible: true,
          xRatio: 0.04,
          yRatio: 0.14,
          widthRatio: 0.44,
          heightRatio: 0.78,
          contentScale: 1,
          inheritPositionFromEditor: false,
          inheritSizeFromEditor: false,
        },
      }
    case 'map-full':
      return DEFAULT_EXPORT_COMPOSITION_LAYOUT
    case 'custom':
    default:
      return { ...DEFAULT_EXPORT_COMPOSITION_LAYOUT, presetId: 'custom' }
  }
}

export function applyEditorLegendToComposition(
  composition: ExportCompositionLayout,
  editorRatios: OrganizationalLegendRatioLayout,
): ExportCompositionLayout {
  return {
    ...composition,
    presetId: 'custom',
    organizationalLegend: {
      ...composition.organizationalLegend,
      xRatio: editorRatios.xRatio,
      yRatio: editorRatios.yRatio,
      widthRatio: editorRatios.widthRatio,
      heightRatio: editorRatios.heightRatio,
      inheritPositionFromEditor: true,
      inheritSizeFromEditor: true,
      contentScale: LEGEND_CONTENT_SCALE_DEFAULT,
    },
  }
}

export function sanitizeExportCompositionLayout(
  value: (Partial<ExportCompositionLayout> & LegacySplitExportLayoutFields) | null | undefined,
): ExportCompositionLayout {
  if (!value) return DEFAULT_EXPORT_COMPOSITION_LAYOUT

  const migrated = migrateLegacySplitExportLayout(value)

  const presetId =
    migrated.presetId === 'map-full' ||
    migrated.presetId === 'map-right-legend-left' ||
    migrated.presetId === 'map-top-right' ||
    migrated.presetId === 'custom'
      ? migrated.presetId
      : DEFAULT_EXPORT_COMPOSITION_LAYOUT.presetId

  const base = getExportCompositionPreset(presetId)

  return {
    presetId,
    title: {
      visible: migrated.title?.visible !== false,
      text: String(migrated.title?.text ?? base.title.text),
      xRatio: clampRatio(migrated.title?.xRatio, base.title.xRatio),
      yRatio: clampRatio(migrated.title?.yRatio, base.title.yRatio),
      widthRatio: clampRatio(migrated.title?.widthRatio, base.title.widthRatio),
      fontSize: clampNumber(migrated.title?.fontSize, 12, 72, base.title.fontSize),
      fontWeight: migrated.title?.fontWeight === 400 ? 400 : 700,
      textAlign:
        migrated.title?.textAlign === 'center' || migrated.title?.textAlign === 'right'
          ? migrated.title.textAlign
          : 'left',
    },
    map: {
      xRatio: clampRatio(migrated.map?.xRatio, base.map.xRatio),
      yRatio: clampRatio(migrated.map?.yRatio, base.map.yRatio),
      widthRatio: clampRatio(migrated.map?.widthRatio, base.map.widthRatio),
      heightRatio: clampRatio(migrated.map?.heightRatio, base.map.heightRatio),
      preserveAspectRatio: migrated.map?.preserveAspectRatio !== false,
    },
    organizationalLegend: {
      visible: migrated.organizationalLegend?.visible !== false,
      xRatio: clampRatio(
        migrated.organizationalLegend?.xRatio,
        base.organizationalLegend.xRatio,
      ),
      yRatio: clampRatio(
        migrated.organizationalLegend?.yRatio,
        base.organizationalLegend.yRatio,
      ),
      widthRatio: clampRatio(
        migrated.organizationalLegend?.widthRatio,
        base.organizationalLegend.widthRatio,
      ),
      heightRatio: clampRatio(
        migrated.organizationalLegend?.heightRatio,
        base.organizationalLegend.heightRatio,
      ),
      contentScale: clampContentScale(
        migrated.organizationalLegend?.contentScale,
        base.organizationalLegend.contentScale,
      ),
      inheritPositionFromEditor: migrated.organizationalLegend?.inheritPositionFromEditor !== false,
      inheritSizeFromEditor: migrated.organizationalLegend?.inheritSizeFromEditor !== false,
    },
  }
}

export function migrateLegacyExportToComposition(
  inheritFromEditor: boolean,
  layout: OrganizationalLegendRatioLayout | null,
): ExportCompositionLayout {
  const composition = sanitizeExportCompositionLayout(DEFAULT_EXPORT_COMPOSITION_LAYOUT)
  if (inheritFromEditor && !layout) {
    return {
      ...composition,
      organizationalLegend: {
        ...composition.organizationalLegend,
        inheritPositionFromEditor: true,
        inheritSizeFromEditor: true,
      },
    }
  }
  if (!layout) return composition
  return {
    ...composition,
    presetId: 'custom',
    organizationalLegend: {
      ...composition.organizationalLegend,
      ...layout,
      inheritPositionFromEditor: false,
      inheritSizeFromEditor: false,
      contentScale: LEGEND_CONTENT_SCALE_DEFAULT,
    },
  }
}
