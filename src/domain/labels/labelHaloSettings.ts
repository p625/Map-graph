export interface LabelHaloStyle {
  enabled: boolean
  color: string
  widthPx: number
}

export interface MapLabelHaloSettings {
  workplace: LabelHaloStyle
  region: LabelHaloStyle
  district: LabelHaloStyle
}

export const HALO_WIDTH_MIN = 0
export const HALO_WIDTH_MAX = 4

export const DEFAULT_LABEL_HALO_SETTINGS: MapLabelHaloSettings = {
  workplace: { enabled: false, color: '#f8fafc', widthPx: 1 },
  region: { enabled: false, color: '#e2e8f0', widthPx: 1.5 },
  district: { enabled: false, color: '#ffffff', widthPx: 1 },
}

function clampHaloWidth(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(HALO_WIDTH_MAX, Math.max(HALO_WIDTH_MIN, parsed)) * 10) / 10
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return value.trim()
}

function sanitizeHaloStyle(
  value: Partial<LabelHaloStyle> | undefined,
  fallback: LabelHaloStyle,
): LabelHaloStyle {
  return {
    enabled: value?.enabled ?? fallback.enabled,
    color: sanitizeColor(value?.color, fallback.color),
    widthPx: clampHaloWidth(value?.widthPx, fallback.widthPx),
  }
}

export function sanitizeLabelHaloSettings(
  value: Partial<MapLabelHaloSettings> | null | undefined,
  legacyEnabled?: boolean,
): MapLabelHaloSettings {
  const workplaceFallback = {
    ...DEFAULT_LABEL_HALO_SETTINGS.workplace,
    enabled: legacyEnabled ?? DEFAULT_LABEL_HALO_SETTINGS.workplace.enabled,
  }

  if (!value) {
    return {
      workplace: workplaceFallback,
      region: DEFAULT_LABEL_HALO_SETTINGS.region,
      district: DEFAULT_LABEL_HALO_SETTINGS.district,
    }
  }

  return {
    workplace: sanitizeHaloStyle(value.workplace, workplaceFallback),
    region: sanitizeHaloStyle(value.region, DEFAULT_LABEL_HALO_SETTINGS.region),
    district: sanitizeHaloStyle(value.district, DEFAULT_LABEL_HALO_SETTINGS.district),
  }
}

export function resolveHaloStyleForLevel(
  settings: MapLabelHaloSettings,
  level: 'workplace' | 'region' | 'district',
): LabelHaloStyle {
  if (level === 'region') return settings.region
  if (level === 'district') return settings.district
  return settings.workplace
}
