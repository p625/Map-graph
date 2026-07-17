import type { MapLabel } from './labelEngine'

export interface LabelPositionOverride {
  entityId: string
  displayText?: string
  offsetX?: number
  offsetY?: number
  fontSizePx?: number
  manualPosition?: boolean
}

export type WorkplaceLabelOverride = LabelPositionOverride & { workplaceId: string }
export type RegionLabelOverride = LabelPositionOverride & { regionId: string }
export type WorkplaceLabelOverrideMap = Record<string, WorkplaceLabelOverride>
export type RegionLabelOverrideMap = Record<string, RegionLabelOverride>

export const WORKPLACE_LABEL_OVERRIDES_KEY = 'map-graph-workplace-label-overrides-v1'
export const REGION_LABEL_OVERRIDES_KEY = 'map-graph-region-label-overrides-v1'

function sanitizeOverride(
  entityId: string,
  value: Partial<LabelPositionOverride> | undefined,
): LabelPositionOverride | null {
  if (!value) return null
  const hasText = typeof value.displayText === 'string' && value.displayText.length > 0
  const hasOffset =
    (typeof value.offsetX === 'number' && value.offsetX !== 0) ||
    (typeof value.offsetY === 'number' && value.offsetY !== 0)
  const hasFont = typeof value.fontSizePx === 'number' && value.fontSizePx > 0
  const manual = value.manualPosition === true

  if (!hasText && !hasOffset && !hasFont && !manual) return null

  return {
    entityId,
    displayText: hasText ? value.displayText : undefined,
    offsetX: typeof value.offsetX === 'number' ? value.offsetX : undefined,
    offsetY: typeof value.offsetY === 'number' ? value.offsetY : undefined,
    fontSizePx: hasFont ? Math.round(value.fontSizePx!) : undefined,
    manualPosition: manual || hasOffset,
  }
}

export function sanitizeWorkplaceLabelOverrides(
  value: Record<string, Partial<WorkplaceLabelOverride>> | null | undefined,
): WorkplaceLabelOverrideMap {
  if (!value || typeof value !== 'object') return {}
  const result: WorkplaceLabelOverrideMap = {}
  for (const [workplaceId, override] of Object.entries(value)) {
    const sanitized = sanitizeOverride(workplaceId, { ...override, entityId: workplaceId })
    if (sanitized) {
      result[workplaceId] = { ...sanitized, workplaceId }
    }
  }
  return result
}

export function sanitizeRegionLabelOverrides(
  value: Record<string, Partial<RegionLabelOverride>> | null | undefined,
): RegionLabelOverrideMap {
  if (!value || typeof value !== 'object') return {}
  const result: RegionLabelOverrideMap = {}
  for (const [regionId, override] of Object.entries(value)) {
    const sanitized = sanitizeOverride(regionId, { ...override, entityId: regionId })
    if (sanitized) {
      result[regionId] = { ...sanitized, regionId }
    }
  }
  return result
}

function applyOverrideToLabel(
  label: MapLabel,
  override: LabelPositionOverride,
  mapWidth: number,
  mapHeight: number,
): MapLabel {
  const text = override.displayText ?? label.text
  const x = label.x + (override.offsetX ?? 0)
  const y = label.y + (override.offsetY ?? 0)
  const fontSizePx = override.fontSizePx ?? label.style.fontSizePx

  return {
    ...label,
    text,
    x: Math.max(0, Math.min(mapWidth, x)),
    y: Math.max(0, Math.min(mapHeight, y)),
    fontSize: fontSizePx,
    manualPosition: override.manualPosition ?? false,
    style: {
      ...label.style,
      fontSize: fontSizePx,
      fontSizePx,
      collisionAvoidance: override.manualPosition ? false : label.style.collisionAvoidance,
    },
  }
}

export function applyLabelOverrides(
  labels: MapLabel[],
  workplaceOverrides: WorkplaceLabelOverrideMap,
  regionOverrides: RegionLabelOverrideMap,
  mapWidth: number,
  mapHeight: number,
): MapLabel[] {
  if (
    Object.keys(workplaceOverrides).length === 0 &&
    Object.keys(regionOverrides).length === 0
  ) {
    return labels
  }

  return labels.map((label) => {
    if (label.level === 'workplace') {
      const workplaceId = label.id.replace(/^label-workplace-/, '')
      const override = workplaceOverrides[workplaceId]
      if (!override) return label
      return applyOverrideToLabel(label, override, mapWidth, mapHeight)
    }
    if (label.level === 'region') {
      const regionId = label.id.replace(/^label-region-/, '')
      const override = regionOverrides[regionId]
      if (!override) return label
      return applyOverrideToLabel(label, override, mapWidth, mapHeight)
    }
    return label
  })
}

/** @deprecated použij applyLabelOverrides */
export function applyWorkplaceLabelOverrides(
  labels: MapLabel[],
  overrides: WorkplaceLabelOverrideMap,
  mapWidth: number,
  mapHeight: number,
): MapLabel[] {
  return applyLabelOverrides(labels, overrides, {}, mapWidth, mapHeight)
}

export function resolveWorkplaceLabelLines(
  override: LabelPositionOverride | undefined,
  defaultName: string,
): string[] {
  if (override?.displayText) {
    return override.displayText.split('\n').filter((line) => line.length > 0)
  }
  return [defaultName]
}
