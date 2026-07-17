import type { MapLabel } from './labelEngine'
import { composeLabelText, resolveLabelNameLines } from './labelContent'

export interface LabelPositionOverride {
  offsetX?: number
  offsetY?: number
  manualPosition?: boolean
  updatedAt?: string
}

export interface WorkplaceLabelOverride extends LabelPositionOverride {
  workplaceId: string
  displayText?: string
  fontSizePx?: number
}

export type WorkplaceLabelOverrideMap = Record<string, WorkplaceLabelOverride>

export const WORKPLACE_LABEL_OVERRIDES_KEY = 'map-graph-workplace-label-overrides-v2'
export const WORKPLACE_LABEL_OVERRIDES_KEY_V1 = 'map-graph-workplace-label-overrides-v1'

export interface PersistedWorkplaceLabelOverrides {
  version: 2
  overrides: WorkplaceLabelOverrideMap
}

export function sanitizeWorkplaceLabelOverride(
  workplaceId: string,
  value: Partial<WorkplaceLabelOverride> | undefined,
): WorkplaceLabelOverride | null {
  if (!value) return null
  const hasText = typeof value.displayText === 'string' && value.displayText.length > 0
  const hasOffset =
    typeof value.offsetX === 'number' ||
    typeof value.offsetY === 'number'
  const hasFont = typeof value.fontSizePx === 'number' && value.fontSizePx > 0
  const manual = value.manualPosition === true

  if (!hasText && !hasOffset && !hasFont && !manual) return null

  return {
    workplaceId,
    displayText: hasText ? value.displayText : undefined,
    offsetX: typeof value.offsetX === 'number' ? value.offsetX : undefined,
    offsetY: typeof value.offsetY === 'number' ? value.offsetY : undefined,
    fontSizePx: hasFont ? Math.round(value.fontSizePx!) : undefined,
    manualPosition: manual || hasOffset,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  }
}

export function sanitizeWorkplaceLabelOverrides(
  value: Record<string, Partial<WorkplaceLabelOverride>> | null | undefined,
): WorkplaceLabelOverrideMap {
  if (!value || typeof value !== 'object') return {}
  const result: WorkplaceLabelOverrideMap = {}
  for (const [workplaceId, override] of Object.entries(value)) {
    const sanitized = sanitizeWorkplaceLabelOverride(workplaceId, override)
    if (sanitized) result[workplaceId] = sanitized
  }
  return result
}

export function loadPersistedWorkplaceLabelOverrides(
  loadJson: <T>(key: string, fallback: T) => T,
): WorkplaceLabelOverrideMap {
  const v2 = loadJson<PersistedWorkplaceLabelOverrides | null>(WORKPLACE_LABEL_OVERRIDES_KEY, null)
  if (v2 && v2.version === 2 && v2.overrides) {
    return sanitizeWorkplaceLabelOverrides(v2.overrides)
  }

  const legacy = loadJson<Record<string, Partial<WorkplaceLabelOverride>> | null>(
    WORKPLACE_LABEL_OVERRIDES_KEY_V1,
    null,
  )
  if (legacy && typeof legacy === 'object' && !('version' in legacy)) {
    return sanitizeWorkplaceLabelOverrides(legacy)
  }

  if (legacy && typeof legacy === 'object' && 'overrides' in legacy) {
    const wrapped = legacy as unknown as PersistedWorkplaceLabelOverrides
    return sanitizeWorkplaceLabelOverrides(wrapped.overrides)
  }

  return {}
}

export function serializeWorkplaceLabelOverrides(
  overrides: WorkplaceLabelOverrideMap,
): PersistedWorkplaceLabelOverrides {
  return {
    version: 2,
    overrides: sanitizeWorkplaceLabelOverrides(overrides),
  }
}

export function applyWorkplaceLabelOverrides(
  labels: MapLabel[],
  overrides: WorkplaceLabelOverrideMap,
  mapWidth: number,
  mapHeight: number,
): MapLabel[] {
  if (Object.keys(overrides).length === 0) return labels

  return labels.map((label) => {
    if (label.level !== 'workplace') return label
    const workplaceId = label.id.replace(/^label-workplace-/, '')
    const override = overrides[workplaceId]
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

export function mergeWorkplaceLabelOverrideMaps(
  base: WorkplaceLabelOverrideMap,
  draft: WorkplaceLabelOverrideMap,
): WorkplaceLabelOverrideMap {
  if (Object.keys(draft).length === 0) return base
  const merged = { ...base }
  for (const [workplaceId, patch] of Object.entries(draft)) {
    const existing = merged[workplaceId] ?? { workplaceId }
    const next = sanitizeWorkplaceLabelOverride(workplaceId, { ...existing, ...patch, workplaceId })
    if (next) merged[workplaceId] = next
    else delete merged[workplaceId]
  }
  return merged
}
