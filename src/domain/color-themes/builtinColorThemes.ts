import { visualizationThemes } from '../visualization/themes'
import { scaleColorsFromSequentialScale } from './colorInterpolation'
import type { MapColorTheme } from './types'

export const BUILTIN_COLOR_THEME_PREFIX = 'builtin:'

export function isBuiltinColorThemeId(id: string): boolean {
  return id.startsWith(BUILTIN_COLOR_THEME_PREFIX)
}

export function builtinColorThemeIdFromVisualizationThemeId(visualizationThemeId: string): string {
  return `${BUILTIN_COLOR_THEME_PREFIX}${visualizationThemeId}`
}

export function visualizationThemeIdFromBuiltinColorThemeId(colorThemeId: string): string | null {
  if (!isBuiltinColorThemeId(colorThemeId)) return null
  return colorThemeId.slice(BUILTIN_COLOR_THEME_PREFIX.length)
}

export function buildBuiltinColorThemes(): MapColorTheme[] {
  return visualizationThemes.map((theme) => ({
    id: builtinColorThemeIdFromVisualizationThemeId(theme.id),
    name: theme.name,
    source: 'builtin',
    scaleType: 'continuous',
    stops: scaleColorsFromSequentialScale(theme.sequentialScale),
  }))
}
