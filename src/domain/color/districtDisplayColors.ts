import { colorFromPalette } from '../visualization/colorUtils'
import { classicTheme } from '../visualization/themes/classic'
import { resolveMapColor } from './mapColorValidation'

export const DISTRICT_FALLBACK_PALETTE = classicTheme.workplacePalette

export function defaultDistrictColor(districtId: string, districtName: string): string {
  return colorFromPalette(DISTRICT_FALLBACK_PALETTE, districtName || districtId)
}

export function resolveDistrictDisplayColor(
  districtId: string,
  districtName: string,
  overrides: Record<string, string>,
): string {
  const custom = overrides[districtId]
  const fallback = defaultDistrictColor(districtId, districtName)
  return resolveMapColor(custom, fallback)
}
