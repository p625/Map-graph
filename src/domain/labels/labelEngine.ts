import { getGeometryCache } from '../territory/geometryCache'
import type { TerritoryLayers } from '../territory/types'
import type { WorkplaceResolver } from '../territory/workplaceResolver'
import { getNumericColumnValue, getRecordForDistrict } from '../visualization/contextUtils'
import type { VisualizationContext } from '../visualization/types'
import {
  DEFAULT_LABEL_FONT_SIZES,
  DISTRICT_FONT_MAX,
  DISTRICT_FONT_MIN,
  REGION_FONT_MAX,
  REGION_FONT_MIN,
  sanitizeLabelFontSizes,
  sanitizeLabelVisibility,
  sanitizeWorkplaceFontSizePx,
  WORKPLACE_FONT_MAX,
  WORKPLACE_FONT_MIN,
  type MapLabelFontSizes,
  type MapLabelVisibility,
} from './labelSettings'
import {
  resolveHaloStyleForLevel,
  sanitizeLabelHaloSettings,
  type MapLabelHaloSettings,
} from './labelHaloSettings'
import {
  applyRegionLabelOverrides,
  type RegionLabelOverrideMap,
} from './regionLabelOverrides'
import {
  applyWorkplaceLabelOverrides,
  type WorkplaceLabelOverrideMap,
} from './workplaceLabelOverrides'
import {
  composeLabelText,
  resolveLabelNameLines,
  resolveWorkplaceValueText,
  splitDisplayName,
} from './labelContent'

export type { MapLabelHaloSettings, LabelHaloStyle } from './labelHaloSettings'
export { DEFAULT_LABEL_HALO_SETTINGS, sanitizeLabelHaloSettings } from './labelHaloSettings'
export type { RegionLabelOverride, RegionLabelOverrideMap } from './regionLabelOverrides'
export { applyRegionLabelOverrides, sanitizeRegionLabelOverrides } from './regionLabelOverrides'
export type { WorkplaceLabelOverride, WorkplaceLabelOverrideMap } from './workplaceLabelOverrides'
export { applyWorkplaceLabelOverrides, sanitizeWorkplaceLabelOverrides } from './workplaceLabelOverrides'
export {
  DEFAULT_LABEL_FONT_SIZES,
  DEFAULT_LABEL_VISIBILITY,
  DISTRICT_FONT_MAX,
  DISTRICT_FONT_MIN,
  REGION_FONT_MAX,
  REGION_FONT_MIN,
  sanitizeDistrictFontSizePx,
  sanitizeLabelFontSizes,
  sanitizeLabelVisibility,
  sanitizeRegionFontSizePx,
  sanitizeWorkplaceFontSizePx,
  WORKPLACE_FONT_MAX,
  WORKPLACE_FONT_MIN,
} from './labelSettings'

export type LabelScope = 'none' | 'district' | 'workplace' | 'region'
export type LabelContentMode = 'name' | 'value' | 'name-value'
export type LabelSizePreset = 'small' | 'medium' | 'large'

export const LABEL_FONT_SIZE_MIN = WORKPLACE_FONT_MIN
export const LABEL_FONT_SIZE_MAX = WORKPLACE_FONT_MAX
export const DEFAULT_LABEL_FONT_SIZE_PX = DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx

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
  letterSpacing?: number
  textTransform?: 'uppercase' | 'none'
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
  manualPosition?: boolean
  nameLines?: string[]
  valueText?: string | null
  contentMode?: LabelContentMode
}

export interface LabelEngineInput {
  resolver: WorkplaceResolver
  territories: TerritoryLayers
  width: number
  height: number
  assignmentHash: string
  labelVisibility?: MapLabelVisibility
  labelFontSizes?: MapLabelFontSizes
  contentMode?: LabelContentMode
  context?: VisualizationContext
  labelHaloSettings?: MapLabelHaloSettings
  /** @deprecated použij labelHaloSettings */
  labelHaloEnabled?: boolean
  labelHideOnCollision?: boolean
  disableCollisionAvoidance?: boolean
  workplaceLabelOverrides?: WorkplaceLabelOverrideMap
  regionLabelOverrides?: RegionLabelOverrideMap
  /** @deprecated použij labelVisibility */
  scope?: LabelScope
  labelSizePreset?: LabelSizePreset
  labelFontSizePx?: number
}

export const DEFAULT_MAP_LABEL_STYLE: MapLabelStyle = {
  fontSize: DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx,
  fontSizePx: DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx,
  minFontSizePx: WORKPLACE_FONT_MIN,
  maxFontSizePx: WORKPLACE_FONT_MAX,
  fontWeight: 500,
  textColor: '#1e293b',
  haloEnabled: false,
  haloColor: '#ffffff',
  haloWidth: 1,
  maxWidth: 110,
  collisionAvoidance: true,
  letterSpacing: 0,
  textTransform: 'none',
}

export function sanitizeLabelFontSizePx(value: unknown): number {
  return sanitizeWorkplaceFontSizePx(value)
}

function buildLabelStyle(
  level: LabelScope,
  fontSizePx: number,
  halo: { enabled: boolean; color: string; widthPx: number },
  collisionAvoidance = true,
): MapLabelStyle {
  const haloEnabled = halo.enabled && halo.widthPx > 0
  const base = {
    fontSize: fontSizePx,
    fontSizePx,
    haloEnabled,
    haloColor: halo.color,
    collisionAvoidance,
    haloWidth: haloEnabled ? halo.widthPx : 0,
  }

  if (level === 'region') {
    return {
      ...DEFAULT_MAP_LABEL_STYLE,
      ...base,
      minFontSizePx: REGION_FONT_MIN,
      maxFontSizePx: REGION_FONT_MAX,
      fontWeight: 700,
      maxWidth: 140,
      letterSpacing: 0.4,
      textTransform: 'none',
    }
  }

  if (level === 'workplace') {
    return {
      ...DEFAULT_MAP_LABEL_STYLE,
      ...base,
      minFontSizePx: WORKPLACE_FONT_MIN,
      maxFontSizePx: WORKPLACE_FONT_MAX,
      fontWeight: 600,
      maxWidth: 110,
    }
  }

  return {
    ...DEFAULT_MAP_LABEL_STYLE,
    ...base,
    minFontSizePx: DISTRICT_FONT_MIN,
    maxFontSizePx: DISTRICT_FONT_MAX,
    fontWeight: 500,
    maxWidth: 90,
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
  nameLines: string[],
  contentMode: LabelContentMode,
  valueText: string | null,
): string {
  return composeLabelText(nameLines, valueText, contentMode)
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
      haloWidth: label.style.haloEnabled ? label.style.haloWidth : 0,
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
  hideDistrictOnCollision: boolean,
): MapLabel {
  if (!label.style.collisionAvoidance || label.manualPosition) {
    placed.push(estimateLabelBox(label))
    return { ...label, visible: true }
  }

  const minFontSizePx = label.style.minFontSizePx
  const neverHide = label.level === 'region' || label.level === 'workplace'

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
  placed.push(estimateLabelBox(fallback))
  const mayHide = !neverHide && hideDistrictOnCollision && label.level === 'district'
  return {
    ...fallback,
    visible: !mayHide,
  }
}

function applyCollisionAvoidance(labels: MapLabel[], hideDistrictOnCollision: boolean): MapLabel[] {
  const sorted = [...labels].sort((a, b) => levelPriority(b.level) - levelPriority(a.level))
  const placed: LabelBox[] = []
  const result: MapLabel[] = []

  for (const label of sorted) {
    result.push(placeLabelWithFallback(label, placed, hideDistrictOnCollision))
  }

  return result
}

function buildDistrictLabels(
  input: LabelEngineInput,
  visibility: MapLabelVisibility,
  fontSizes: MapLabelFontSizes,
  haloSettings: MapLabelHaloSettings,
): MapLabel[] {
  if (!visibility.showDistrictLabels) return []

  const contentMode = input.contentMode ?? 'name'
  const halo = resolveHaloStyleForLevel(haloSettings, 'district')
  const collisionAvoidance = !input.disableCollisionAvoidance
  const fontSizePx = fontSizes.districtFontSizePx
  const labels: MapLabel[] = []

  for (const polygon of input.territories.fillPolygons) {
    const district = input.resolver.getDistrict(polygon.entityId)
    if (!district) continue
    const workplaceId = input.resolver.getWorkplaceIdForDistrict(district.id)
    const valueText = workplaceId ? resolveWorkplaceValue(input.context, workplaceId) : null
    const nameLines = splitDisplayName(district.name)
    labels.push({
      id: `label-district-${district.id}`,
      text: buildLabelText(nameLines, contentMode, valueText),
      nameLines,
      valueText: resolveWorkplaceValueText(contentMode, valueText),
      contentMode,
      x: polygon.centroid[0],
      y: polygon.centroid[1],
      level: 'district',
      fontSize: fontSizePx,
      style: buildLabelStyle('district', fontSizePx, halo, collisionAvoidance),
      visible: true,
    })
  }

  return labels
}

function buildWorkplaceLabels(
  input: LabelEngineInput,
  visibility: MapLabelVisibility,
  fontSizes: MapLabelFontSizes,
  haloSettings: MapLabelHaloSettings,
): MapLabel[] {
  if (!visibility.showWorkplaceLabels) return []

  const { resolver, territories, width, assignmentHash } = input
  const contentMode = input.contentMode ?? 'name'
  const halo = resolveHaloStyleForLevel(haloSettings, 'workplace')
  const collisionAvoidance = !input.disableCollisionAvoidance
  const fontSizePx = fontSizes.workplaceFontSizePx
  const overrides = input.workplaceLabelOverrides ?? {}
  const labels: MapLabel[] = []

  for (const workplace of resolver.workplaces) {
    const districtIds = resolver.getDistrictIdsForWorkplace(workplace.id)
    if (districtIds.length === 0) continue

    const anchor =
      unionLabelPoint(`workplace:${assignmentHash}:${workplace.id}`, districtIds, width, input.height) ??
      territories.fillPolygons.find((item) => districtIds.includes(item.entityId))?.centroid

    if (!anchor) continue

    const override = overrides[workplace.id]
    const defaultName = resolver.getDisplayName(workplace.id)
    const datasetValue = resolveWorkplaceValue(input.context, workplace.id)
    const valueText = resolveWorkplaceValueText(contentMode, datasetValue)
    const nameLines = resolveLabelNameLines(override?.displayText, defaultName)
    const text = buildLabelText(nameLines, contentMode, valueText)

    labels.push({
      id: `label-workplace-${workplace.id}`,
      text,
      nameLines,
      valueText,
      contentMode,
      x: anchor[0],
      y: anchor[1],
      level: 'workplace',
      fontSize: override?.fontSizePx ?? fontSizePx,
      style: buildLabelStyle(
        'workplace',
        override?.fontSizePx ?? fontSizePx,
        halo,
        override?.manualPosition ? false : collisionAvoidance,
      ),
      visible: true,
      manualPosition: override?.manualPosition,
    })
  }

  return labels
}

function buildRegionLabels(
  input: LabelEngineInput,
  visibility: MapLabelVisibility,
  fontSizes: MapLabelFontSizes,
  haloSettings: MapLabelHaloSettings,
): MapLabel[] {
  if (!visibility.showRegionLabels) return []

  const { resolver, width, assignmentHash } = input
  const halo = resolveHaloStyleForLevel(haloSettings, 'region')
  const collisionAvoidance = !input.disableCollisionAvoidance
  const fontSizePx = fontSizes.regionFontSizePx
  const overrides = input.regionLabelOverrides ?? {}
  const labels: MapLabel[] = []

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

    const override = overrides[region.id]
    const nameLines = resolveLabelNameLines(override?.displayText, region.name)
    const text = buildLabelText(nameLines, 'name', null)

    labels.push({
      id: `label-region-${region.id}`,
      text,
      nameLines,
      valueText: null,
      contentMode: 'name',
      x: anchor[0],
      y: anchor[1],
      level: 'region',
      fontSize: override?.fontSizePx ?? fontSizePx,
      style: buildLabelStyle(
        'region',
        override?.fontSizePx ?? fontSizePx,
        halo,
        override?.manualPosition ? false : collisionAvoidance,
      ),
      visible: true,
      manualPosition: override?.manualPosition,
    })
  }

  return labels
}

export function buildMapLabels(input: LabelEngineInput): MapLabel[] {
  const visibility = input.labelVisibility
    ? sanitizeLabelVisibility(input.labelVisibility)
    : sanitizeLabelVisibility(undefined, input.scope ?? 'none')

  const fontSizes = sanitizeLabelFontSizes(input.labelFontSizes, input.labelFontSizePx)
  const haloSettings = sanitizeLabelHaloSettings(input.labelHaloSettings, input.labelHaloEnabled)

  const hideDistrictOnCollision = input.labelHideOnCollision ?? false
  const collisionAvoidance = !input.disableCollisionAvoidance

  const labels = [
    ...buildRegionLabels(input, visibility, fontSizes, haloSettings),
    ...buildWorkplaceLabels(input, visibility, fontSizes, haloSettings),
    ...buildDistrictLabels(input, visibility, fontSizes, haloSettings),
  ]

  const withWorkplaceOverrides = applyWorkplaceLabelOverrides(
    labels,
    input.workplaceLabelOverrides ?? {},
    input.width,
    input.height,
  )
  const withOverrides = applyRegionLabelOverrides(
    withWorkplaceOverrides,
    input.regionLabelOverrides ?? {},
    input.width,
    input.height,
  )

  if (!collisionAvoidance) return withOverrides
  return applyCollisionAvoidance(withOverrides, hideDistrictOnCollision)
}
