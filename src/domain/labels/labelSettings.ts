import type { LabelScope } from './labelEngine'

export interface MapLabelVisibility {
  showWorkplaceLabels: boolean
  showRegionLabels: boolean
  showDistrictLabels: boolean
}

export interface MapLabelFontSizes {
  workplaceFontSizePx: number
  regionFontSizePx: number
  districtFontSizePx: number
}

export const WORKPLACE_FONT_MIN = 4
export const WORKPLACE_FONT_MAX = 24
export const REGION_FONT_MIN = 6
export const REGION_FONT_MAX = 32
export const DISTRICT_FONT_MIN = 4
export const DISTRICT_FONT_MAX = 20

export const DEFAULT_LABEL_VISIBILITY: MapLabelVisibility = {
  showWorkplaceLabels: true,
  showRegionLabels: false,
  showDistrictLabels: false,
}

export const DEFAULT_LABEL_FONT_SIZES: MapLabelFontSizes = {
  workplaceFontSizePx: 8,
  regionFontSizePx: 14,
  districtFontSizePx: 7,
}

function clampFont(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.round(Math.min(max, Math.max(min, parsed)))
}

export function sanitizeWorkplaceFontSizePx(value: unknown): number {
  return clampFont(value, WORKPLACE_FONT_MIN, WORKPLACE_FONT_MAX, DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx)
}

export function sanitizeRegionFontSizePx(value: unknown): number {
  return clampFont(value, REGION_FONT_MIN, REGION_FONT_MAX, DEFAULT_LABEL_FONT_SIZES.regionFontSizePx)
}

export function sanitizeDistrictFontSizePx(value: unknown): number {
  return clampFont(value, DISTRICT_FONT_MIN, DISTRICT_FONT_MAX, DEFAULT_LABEL_FONT_SIZES.districtFontSizePx)
}

export function sanitizeLabelFontSizes(
  value: Partial<MapLabelFontSizes> | null | undefined,
  legacyWorkplacePx?: number,
): MapLabelFontSizes {
  const workplaceFallback =
    legacyWorkplacePx !== undefined
      ? clampFont(legacyWorkplacePx, WORKPLACE_FONT_MIN, WORKPLACE_FONT_MAX, 8)
      : DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx

  if (!value) {
    return {
      workplaceFontSizePx: workplaceFallback,
      regionFontSizePx: DEFAULT_LABEL_FONT_SIZES.regionFontSizePx,
      districtFontSizePx: DEFAULT_LABEL_FONT_SIZES.districtFontSizePx,
    }
  }

  return {
    workplaceFontSizePx: sanitizeWorkplaceFontSizePx(
      value.workplaceFontSizePx ?? workplaceFallback,
    ),
    regionFontSizePx: sanitizeRegionFontSizePx(value.regionFontSizePx),
    districtFontSizePx: sanitizeDistrictFontSizePx(value.districtFontSizePx),
  }
}

export function sanitizeLabelVisibility(
  value: Partial<MapLabelVisibility> | null | undefined,
  legacyScope?: LabelScope,
): MapLabelVisibility {
  if (value) {
    return {
      showWorkplaceLabels: value.showWorkplaceLabels ?? DEFAULT_LABEL_VISIBILITY.showWorkplaceLabels,
      showRegionLabels: value.showRegionLabels ?? DEFAULT_LABEL_VISIBILITY.showRegionLabels,
      showDistrictLabels: value.showDistrictLabels ?? DEFAULT_LABEL_VISIBILITY.showDistrictLabels,
    }
  }

  if (!legacyScope || legacyScope === 'none') {
    return {
      showWorkplaceLabels: false,
      showRegionLabels: false,
      showDistrictLabels: false,
    }
  }

  return {
    showWorkplaceLabels: legacyScope === 'workplace',
    showRegionLabels: legacyScope === 'region',
    showDistrictLabels: legacyScope === 'district',
  }
}

export function labelVisibilityToLegacyScope(visibility: MapLabelVisibility): LabelScope {
  const enabled = [
    visibility.showWorkplaceLabels ? 'workplace' : null,
    visibility.showRegionLabels ? 'region' : null,
    visibility.showDistrictLabels ? 'district' : null,
  ].filter(Boolean)

  if (enabled.length === 0) return 'none'
  if (enabled.length === 1) return enabled[0] as LabelScope
  return 'workplace'
}

export function hasAnyLabelVisibility(visibility: MapLabelVisibility): boolean {
  return (
    visibility.showWorkplaceLabels ||
    visibility.showRegionLabels ||
    visibility.showDistrictLabels
  )
}
