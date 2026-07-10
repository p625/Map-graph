import { colorFromPalette } from '../visualization/colorUtils'
import { classicTheme } from '../visualization/themes/classic'
import { resolveMapColor } from './mapColorValidation'

export const WORKPLACE_FALLBACK_PALETTE = classicTheme.workplacePalette

export function defaultWorkplaceColor(workplaceId: string, workplaceName: string): string {
  return colorFromPalette(WORKPLACE_FALLBACK_PALETTE, workplaceName || workplaceId)
}

export function resolveWorkplaceDisplayColor(
  workplaceId: string,
  workplaceName: string,
  overrides: Record<string, string>,
): string {
  const custom = overrides[workplaceId]
  const fallback = defaultWorkplaceColor(workplaceId, workplaceName)
  return resolveMapColor(custom, fallback)
}
