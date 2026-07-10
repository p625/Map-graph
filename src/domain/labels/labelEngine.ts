import { getGeometryCache } from '../territory/geometryCache'
import type { TerritoryLayers } from '../territory/types'
import type { WorkplaceResolver } from '../territory/workplaceResolver'
import { getNumericColumnValue, getRecordForDistrict } from '../visualization/contextUtils'
import type { VisualizationContext } from '../visualization/types'

export type LabelScope = 'none' | 'district' | 'workplace' | 'region'
export type LabelContentMode = 'name' | 'value' | 'name-value'
export type LabelSizePreset = 'small' | 'medium' | 'large'

export const LABEL_FONT_SIZE_MIN = 4
export const LABEL_FONT_SIZE_MAX = 24
export const DEFAULT_LABEL_FONT_SIZE_PX = 9

export const PRESET_FONT_SIZE_PX: Record<LabelSizePreset, number> = {
  small: 7,
  medium: 9,
  large: 12,
}

export interface MapLabelStyle {
  fontSize: number
  fontSizePx: number
  minFontSizePx: number
  maxFontSizePx: number
  fontWeight: number
  textColor: string
  haloEnabled: boolean
  haloColor: string
  haloWidth: number
  maxWidth: number
  collisionAvoidance: boolean
}

export interface MapLabel {
  id: string
  text: string
  x: number
  y: number
  level: LabelScope
  fontSize: number
  style: MapLabelStyle
  visible: boolean
}

export interface LabelEngineInput {
  resolver: WorkplaceResolver
  territories: TerritoryLayers
  scope: LabelScope
  width: number
  height: number
  assignmentHash: string
  contentMode?: LabelContentMode
  context?: VisualizationContext
  labelSizePreset?: LabelSizePreset
  labelFontSizePx?: number
  labelHaloEnabled?: boolean
  labelHideOnCollision?: boolean
  disableCollisionAvoidance?: boolean
}

export const DEFAULT_MAP_LABEL_STYLE: MapLabelStyle = {
  fontSize: DEFAULT_LABEL_FONT_SIZE_PX,
  fontSizePx: DEFAULT_LABEL_FONT_SIZE_PX,
  minFontSizePx: LABEL_FONT_SIZE_MIN,
  maxFontSizePx: LABEL_FONT_SIZE_MAX,
  fontWeight: 500,
  textColor: '#1e293b',
  haloEnabled: false,
  haloColor: '#ffffff',
  haloWidth: 1,
  maxWidth: 110,
  collisionAvoidance: true,
}

export function sanitizeLabelFontSizePx(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LABEL_FONT_SIZE_PX
  return Math.round(Math.min(LABEL_FONT_SIZE_MAX, Math.max(LABEL_FONT_SIZE_MIN, parsed)))
}

export function resolveLabelFontSizePx(input: LabelEngineInput): number {
  if (input.labelFontSizePx !== undefined) {
    return sanitizeLabelFontSizePx(input.labelFontSizePx)
  }
  const preset = input.labelSizePreset ?? 'small'
  return PRESET_FONT_SIZE_PX[preset]
}

function buildLabelStyle(fontSizePx: number, haloEnabled: boolean, collisionAvoidance = true): MapLabelStyle {
  return {
    ...DEFAULT_MAP_LABEL_STYLE,
    fontSize: fontSizePx,
    fontSizePx,
    haloEnabled,
    collisionAvoidance,
    haloWidth: haloEnabled ? Math.max(0.75, fontSizePx * 0.08) : 0,
  }
}

function formatValue(value: number, columnType?: string): string {
  if (columnType === 'percent') {
    return `${value.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString('cs-CZ')
  }
  return value.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
}

function resolveWorkplaceValue(
  context: VisualizationContext | undefined,
  workplaceId: string,
): string | null {
  if (!context?.column) return null
  const districtIds = context.districts
    .filter((district) => context.districtWorkplaceAssignments[district.id] === workplaceId)
    .map((district) => district.id)
  const districtId = districtIds[0]
  if (!districtId) return null
  const record = getRecordForDistrict(context, districtId)
  const value = getNumericColumnValue(record, context.column.key)
  if (value === null) return null
  return formatValue(value, context.column.type)
}

function buildLabelText(
  name: string,
  contentMode: LabelContentMode,
  valueText: string | null,
): string {
  if (contentMode === 'value') return valueText ?? name
  if (contentMode === 'name-value' && valueText) return `${name}\n${valueText}`
  return name
}

function unionLabelPoint(
  unionKey: string,
  districtIds: string[],
  width: number,
  height: number,
): [number, number] | null {
  if (districtIds.length === 0) return null
  const cache = getGeometryCache()
  const geometry = cache.getUnionGeometry(unionKey, districtIds)
  if (!geometry) return null
  return cache.getLabelAnchor(`label:${unionKey}`, geometry, width, height)
}

interface LabelBox {
  x: number
  y: number
  width: number
  height: number
}

function estimateLabelBox(label: MapLabel): LabelBox {
  const fontSizePx = label.style.fontSizePx
  const lines = label.text.split('\n').length
  const longestLine = label.text.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
  const charWidth = fontSizePx * 0.52
  const width = Math.min(label.style.maxWidth, longestLine * charWidth + 4)
  const height = fontSizePx * (1.15 * lines + 0.2)
  return {
    x: label.x - width / 2,
    y: label.y - height / 2,
    width,
    height,
  }
}

function boxesOverlap(a: LabelBox, b: LabelBox, gap = 2): boolean {
  return !(
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  )
}

function levelPriority(level: LabelScope): number {
  if (level === 'region') return 3
  if (level === 'workplace') return 2
  return 1
}

function withFontSize(label: MapLabel, fontSizePx: number): MapLabel {
  return {
    ...label,
    fontSize: fontSizePx,
    style: {
      ...label.style,
      fontSize: fontSizePx,
      fontSizePx,
      haloWidth: label.style.haloEnabled ? Math.max(0.75, fontSizePx * 0.08) : 0,
    },
  }
}

function offsetAttempts(fontSizePx: number): [number, number][] {
  const step = Math.max(2, Math.round(fontSizePx * 0.35))
  return [
    [0, 0],
    [0, -step],
    [step, 0],
    [-step, 0],
    [0, step],
    [step, -step],
    [-step, -step],
    [step, step],
    [-step, step],
    [0, -step * 2],
    [step * 2, 0],
    [-step * 2, 0],
    [0, step * 2],
  ]
}

function placeLabelWithFallback(
  label: MapLabel,
  placed: LabelBox[],
  hideOnCollision: boolean,
): MapLabel {
  if (!label.style.collisionAvoidance) {
    placed.push(estimateLabelBox(label))
    return { ...label, visible: true }
  }

  const minFontSizePx = label.style.minFontSizePx

  for (let size = label.style.fontSizePx; size >= minFontSizePx; size -= 1) {
    const sized = withFontSize(label, size)
    for (const [dx, dy] of offsetAttempts(size)) {
      const candidate: MapLabel = {
        ...sized,
        x: label.x + dx,
        y: label.y + dy,
        visible: true,
      }
      const box = estimateLabelBox(candidate)
      if (!placed.some((other) => boxesOverlap(box, other))) {
        placed.push(box)
        return candidate
      }
    }
  }

  const fallback = withFontSize(label, minFontSizePx)
  const mayHide = hideOnCollision && label.level === 'district'
  placed.push(estimateLabelBox(fallback))
  return {
    ...fallback,
    visible: !mayHide,
  }
}

function applyCollisionAvoidance(labels: MapLabel[], hideOnCollision: boolean): MapLabel[] {
  const sorted = [...labels].sort((a, b) => levelPriority(b.level) - levelPriority(a.level))
  const placed: LabelBox[] = []
  const result: MapLabel[] = []

  for (const label of sorted) {
    result.push(placeLabelWithFallback(label, placed, hideOnCollision))
  }

  return result
}

export function buildMapLabels(input: LabelEngineInput): MapLabel[] {
  const { resolver, territories, scope, width, assignmentHash } = input
  if (scope === 'none') return []

  const contentMode = input.contentMode ?? 'name'
  const fontSizePx = resolveLabelFontSizePx(input)
  const haloEnabled = input.labelHaloEnabled ?? false
  const hideOnCollision = input.labelHideOnCollision ?? false
  const collisionAvoidance = !input.disableCollisionAvoidance
  const labels: MapLabel[] = []

  if (scope === 'district') {
    for (const polygon of territories.fillPolygons) {
      const district = resolver.getDistrict(polygon.entityId)
      if (!district) continue
      const workplaceId = resolver.getWorkplaceIdForDistrict(district.id)
      const valueText = workplaceId ? resolveWorkplaceValue(input.context, workplaceId) : null
      labels.push({
        id: `label-district-${district.id}`,
        text: buildLabelText(district.name, contentMode, valueText),
        x: polygon.centroid[0],
        y: polygon.centroid[1],
        level: 'district',
        fontSize: fontSizePx,
        style: buildLabelStyle(fontSizePx, haloEnabled, collisionAvoidance),
        visible: true,
      })
    }
    return applyCollisionAvoidance(labels, hideOnCollision)
  }

  if (scope === 'workplace') {
    for (const workplace of resolver.workplaces) {
      const districtIds = resolver.getDistrictIdsForWorkplace(workplace.id)
      if (districtIds.length === 0) continue

      const anchor =
        unionLabelPoint(`workplace:${assignmentHash}:${workplace.id}`, districtIds, width, input.height) ??
        territories.fillPolygons.find((item) => districtIds.includes(item.entityId))?.centroid

      if (!anchor) continue

      const valueText = resolveWorkplaceValue(input.context, workplace.id)
      labels.push({
        id: `label-workplace-${workplace.id}`,
        text: buildLabelText(resolver.getDisplayName(workplace.id), contentMode, valueText),
        x: anchor[0],
        y: anchor[1],
        level: 'workplace',
        fontSize: fontSizePx,
        style: buildLabelStyle(fontSizePx, haloEnabled, collisionAvoidance),
        visible: true,
      })
    }
    return applyCollisionAvoidance(labels, hideOnCollision)
  }

  if (scope === 'region') {
    for (const region of resolver.regionalOffices) {
      const districtIds = resolver.getDistrictIdsForRegion(region.id)
      if (districtIds.length === 0) continue

      const anchor = unionLabelPoint(
        `region:${assignmentHash}:${region.id}`,
        districtIds,
        width,
        input.height,
      )

      if (!anchor) continue

      labels.push({
        id: `label-region-${region.id}`,
        text: region.name,
        x: anchor[0],
        y: anchor[1],
        level: 'region',
        fontSize: fontSizePx,
        style: buildLabelStyle(fontSizePx, haloEnabled, collisionAvoidance),
        visible: true,
      })
    }
    return applyCollisionAvoidance(labels, hideOnCollision)
  }

  return labels
}
