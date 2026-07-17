import type { MapLabel } from './labelEngine'
import { composeLabelText, resolveLabelNameLines } from './labelContent'

export interface LabelPositionOverride {
  offsetX?: number
  offsetY?: number
  manualPosition?: boolean
  updatedAt?: string
}

export interface RegionLabelOverride extends LabelPositionOverride {
  regionId: string
  displayText?: string
  fontSizePx?: number
}

export type RegionLabelOverrideMap = Record<string, RegionLabelOverride>

export const REGION_LABEL_OVERRIDES_KEY = 'map-graph-region-label-overrides-v2'
export const REGION_LABEL_OVERRIDES_KEY_V1 = 'map-graph-region-label-overrides-v1'

export interface PersistedRegionLabelOverrides {
  version: 2
  overrides: RegionLabelOverrideMap
}

export function sanitizeRegionLabelOverride(
  regionId: string,
  value: Partial<RegionLabelOverride> | undefined,
): RegionLabelOverride | null {
  if (!value) return null
  const hasText = typeof value.displayText === 'string' && value.displayText.length > 0
  const hasOffset =
    typeof value.offsetX === 'number' ||
    typeof value.offsetY === 'number'
  const hasFont = typeof value.fontSizePx === 'number' && value.fontSizePx > 0
  const manual = value.manualPosition === true

  if (!hasText && !hasOffset && !hasFont && !manual) return null

  return {
    regionId,
    displayText: hasText ? value.displayText : undefined,
    offsetX: typeof value.offsetX === 'number' ? value.offsetX : undefined,
    offsetY: typeof value.offsetY === 'number' ? value.offsetY : undefined,
    fontSizePx: hasFont ? Math.round(value.fontSizePx!) : undefined,
    manualPosition: manual || hasOffset,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  }
}

export function sanitizeRegionLabelOverrides(
  value: Record<string, Partial<RegionLabelOverride>> | null | undefined,
): RegionLabelOverrideMap {
  if (!value || typeof value !== 'object') return {}
  const result: RegionLabelOverrideMap = {}
  for (const [regionId, override] of Object.entries(value)) {
    const sanitized = sanitizeRegionLabelOverride(regionId, override)
    if (sanitized) result[regionId] = sanitized
  }
  return result
}

export function loadPersistedRegionLabelOverrides(
  loadJson: <T>(key: string, fallback: T) => T,
): RegionLabelOverrideMap {
  const v2 = loadJson<PersistedRegionLabelOverrides | null>(REGION_LABEL_OVERRIDES_KEY, null)
  if (v2 && v2.version === 2 && v2.overrides) {
    return sanitizeRegionLabelOverrides(v2.overrides)
  }

  const legacy = loadJson<Record<string, Partial<RegionLabelOverride>> | null>(
    REGION_LABEL_OVERRIDES_KEY_V1,
    null,
  )
  if (legacy && typeof legacy === 'object' && !('version' in legacy)) {
    return sanitizeRegionLabelOverrides(legacy)
  }

  return {}
}

export function serializeRegionLabelOverrides(
  overrides: RegionLabelOverrideMap,
): PersistedRegionLabelOverrides {
  return {
    version: 2,
    overrides: sanitizeRegionLabelOverrides(overrides),
  }
}

export function applyRegionLabelOverrides(
  labels: MapLabel[],
  overrides: RegionLabelOverrideMap,
  mapWidth: number,
  mapHeight: number,
): MapLabel[] {
  if (Object.keys(overrides).length === 0) return labels

  return labels.map((label) => {
    if (label.level !== 'region') return label
    const regionId = label.id.replace(/^label-region-/, '')
    const override = overrides[regionId]
    if (!override) return label

    const contentMode = label.contentMode ?? 'name'
    const nameLines = override.displayText
      ? resolveLabelNameLines(override.displayText, '')
      : (label.nameLines ?? label.text.split('\n').filter((line) => line.length > 0))
    const valueText = label.valueText ?? null
    const text = composeLabelText(nameLines, valueText, contentMode)
    const x = label.x + (override.offsetX ?? 0)
    const y = label.y + (override.offsetY ?? 0)
    const fontSizePx = override.fontSizePx ?? label.style.fontSizePx

    return {
      ...label,
      text,
      nameLines,
      valueText,
      contentMode,
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
  })
}

export function mergeRegionLabelOverrideMaps(
  base: RegionLabelOverrideMap,
  draft: RegionLabelOverrideMap,
): RegionLabelOverrideMap {
  if (Object.keys(draft).length === 0) return base
  const merged = { ...base }
  for (const [regionId, patch] of Object.entries(draft)) {
    const existing = merged[regionId] ?? { regionId }
    const next = sanitizeRegionLabelOverride(regionId, { ...existing, ...patch, regionId })
    if (next) merged[regionId] = next
    else delete merged[regionId]
  }
  return merged
}
