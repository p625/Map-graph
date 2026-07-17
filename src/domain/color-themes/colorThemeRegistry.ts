import { defaultThemeId, getThemeById } from '../visualization/themes'
import {
  buildBuiltinColorThemes,
  builtinColorThemeIdFromVisualizationThemeId,
} from './builtinColorThemes'
import { buildSequentialScaleFromStops } from './colorInterpolation'
import {
  CUSTOM_DRAFT_COLOR_THEME_ID,
  createTwoStopTheme,
  getMinMaxColorsFromStops,
  type MapColorTheme,
} from './types'

export interface ResolvedColorTheme {
  id: string
  name: string
  source: MapColorTheme['source']
  stops: MapColorTheme['stops']
  sequentialScale: string[]
  isDraft: boolean
}

export interface ColorThemeDraft {
  minColor: string
  maxColor: string
}

const builtinThemes = buildBuiltinColorThemes()

export function getBuiltinColorThemes(): MapColorTheme[] {
  return builtinThemes
}

export function resolveColorThemeIdFromLegacy(themeId: string): string {
  return builtinColorThemeIdFromVisualizationThemeId(themeId)
}

export function findColorThemeById(
  colorThemeId: string,
  customThemes: MapColorTheme[],
): MapColorTheme | null {
  if (colorThemeId === CUSTOM_DRAFT_COLOR_THEME_ID) return null
  const builtin = builtinThemes.find((theme) => theme.id === colorThemeId)
  if (builtin) return builtin
  return customThemes.find((theme) => theme.id === colorThemeId) ?? null
}

export function resolveActiveColorTheme(
  colorThemeId: string,
  customThemes: MapColorTheme[],
  draft: ColorThemeDraft | null,
): ResolvedColorTheme {
  if (colorThemeId === CUSTOM_DRAFT_COLOR_THEME_ID && draft) {
    const stops = createTwoStopTheme(draft.minColor, draft.maxColor).stops
    return {
      id: CUSTOM_DRAFT_COLOR_THEME_ID,
      name: 'Vlastní',
      source: 'custom',
      stops,
      sequentialScale: buildSequentialScaleFromStops(stops),
      isDraft: true,
    }
  }

  const theme = findColorThemeById(colorThemeId, customThemes)
  if (theme) {
    return {
      id: theme.id,
      name: theme.name,
      source: theme.source,
      stops: theme.stops,
      sequentialScale: buildSequentialScaleFromStops(theme.stops),
      isDraft: false,
    }
  }

  const fallback = builtinThemes.find(
    (item) => item.id === builtinColorThemeIdFromVisualizationThemeId(defaultThemeId),
  )!
  return {
    id: fallback.id,
    name: fallback.name,
    source: fallback.source,
    stops: fallback.stops,
    sequentialScale: buildSequentialScaleFromStops(fallback.stops),
    isDraft: false,
  }
}

export function getFallbackColorThemeId(): string {
  return builtinColorThemeIdFromVisualizationThemeId(defaultThemeId)
}

export function draftFromColorTheme(theme: MapColorTheme | ResolvedColorTheme): ColorThemeDraft {
  const { minColor, maxColor } = getMinMaxColorsFromStops(theme.stops)
  return { minColor, maxColor }
}

export function draftFromVisualizationThemeId(themeId: string): ColorThemeDraft {
  const visualizationTheme = getThemeById(themeId)
  const builtin = builtinThemes.find(
    (item) => item.id === builtinColorThemeIdFromVisualizationThemeId(visualizationTheme.id),
  )
  if (builtin) return draftFromColorTheme(builtin)
  return { minColor: '#dbeafe', maxColor: '#1e3a8a' }
}

export function isCustomColorThemeId(colorThemeId: string): boolean {
  return colorThemeId.startsWith('custom-gradient-')
}

export function canEditColorTheme(colorThemeId: string): boolean {
  return isCustomColorThemeId(colorThemeId) || colorThemeId === CUSTOM_DRAFT_COLOR_THEME_ID
}

export function canDeleteColorTheme(colorThemeId: string): boolean {
  return isCustomColorThemeId(colorThemeId)
}

export function resolveTemplateColorThemeId(
  colorThemeId: string | undefined,
  customThemes: MapColorTheme[],
): { colorThemeId: string; usedFallback: boolean } {
  if (!colorThemeId) {
    return { colorThemeId: getFallbackColorThemeId(), usedFallback: false }
  }
  if (colorThemeId === CUSTOM_DRAFT_COLOR_THEME_ID) {
    return { colorThemeId: getFallbackColorThemeId(), usedFallback: true }
  }
  if (findColorThemeById(colorThemeId, customThemes)) {
    return { colorThemeId, usedFallback: false }
  }
  if (getBuiltinColorThemes().some((theme) => theme.id === colorThemeId)) {
    return { colorThemeId, usedFallback: false }
  }
  return { colorThemeId: getFallbackColorThemeId(), usedFallback: true }
}
