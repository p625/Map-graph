export interface VisualizationTheme {
  id: string
  name: string
  description: string
  workplacePalette: string[]
  regionalPalette: string[]
  sequentialScale: string[]
  /** Continuous gradient stops for choropleth interpolation. */
  colorStops?: Array<{ offset: number; color: string }>
  categoricalPalette: string[]
  noDataFill: string
  neutralFill: string
  strokeColor: string
  /** Resolved color theme id when sequential scale comes from color theme registry. */
  colorThemeId?: string
  colorThemeName?: string
}
