import { isValidMapColor, normalizeHexColor } from '../color/mapColorValidation'
import { classicTheme } from '../visualization/themes/classic'
import type { Leader } from './types'

export function defaultLeaderColor(index: number, preserved?: string): string {
  if (preserved && isValidMapColor(preserved)) {
    return normalizeHexColor(preserved)!
  }
  const palette = classicTheme.workplacePalette
  return palette[index % palette.length] ?? '#94a3b8'
}

export function resolveLeaderColor(leader: Leader | undefined, index: number): string {
  if (!leader) return defaultLeaderColor(index)
  return defaultLeaderColor(index, leader.color)
}
