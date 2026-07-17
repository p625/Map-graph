export type ColorThemeSource = 'builtin' | 'custom'

export interface MapColorStop {
  offset: number
  color: string
}

export interface MapColorTheme {
  id: string
  name: string
  source: ColorThemeSource
  scaleType: 'continuous'
  stops: MapColorStop[]
  createdAt?: string
  updatedAt?: string
}

export const CUSTOM_DRAFT_COLOR_THEME_ID = '__custom_draft__'

export const CUSTOM_COLOR_THEMES_STORAGE_KEY = 'map-graph-custom-color-themes-v1'

export const MAX_COLOR_THEME_NAME_LENGTH = 80

export const LEGEND_GRADIENT_STEPS = 11

export function getMinMaxColorsFromStops(stops: MapColorStop[]): { minColor: string; maxColor: string } {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  return {
    minColor: sorted[0]?.color ?? '#dbeafe',
    maxColor: sorted[sorted.length - 1]?.color ?? '#1e3a8a',
  }
}

export function createTwoStopTheme(
  minColor: string,
  maxColor: string,
): Pick<MapColorTheme, 'stops' | 'scaleType'> {
  return {
    scaleType: 'continuous',
    stops: [
      { offset: 0, color: minColor },
      { offset: 1, color: maxColor },
    ],
  }
}
