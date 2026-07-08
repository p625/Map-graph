import { classicTheme } from './classic'
import { colorblindTheme } from './colorblind'
import { highContrastTheme } from './highContrast'
import { pastelTheme } from './pastel'
import { printTheme } from './print'
import type { VisualizationTheme } from './types'

export type { VisualizationTheme } from './types'

export const visualizationThemes: VisualizationTheme[] = [
  classicTheme,
  colorblindTheme,
  printTheme,
  highContrastTheme,
  pastelTheme,
]

export const defaultThemeId = 'classic'

export function getThemeById(id: string): VisualizationTheme {
  return visualizationThemes.find((t) => t.id === id) ?? classicTheme
}
