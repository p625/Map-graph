import { colorFromPalette } from '../visualization/colorUtils'
import { classicTheme } from '../visualization/themes/classic'
import { resolveMapColor } from './mapColorValidation'

export const REGION_FALLBACK_PALETTE = classicTheme.regionalPalette

export function defaultRegionColor(regionId: string, regionName: string): string {
  return colorFromPalette(REGION_FALLBACK_PALETTE, regionName || regionId)
}

export function resolveRegionDisplayColor(
  regionId: string,
  regionName: string,
  overrides: Record<string, string>,
): string {
  const custom = overrides[regionId]
  const fallback = defaultRegionColor(regionId, regionName)
  return resolveMapColor(custom, fallback)
}
