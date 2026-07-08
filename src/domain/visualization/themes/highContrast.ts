import type { VisualizationTheme } from './types'

export const highContrastTheme: VisualizationTheme = {
  id: 'high-contrast',
  name: 'Vysoký kontrast',
  description: 'Silné kontrasty pro projekci',
  workplacePalette: [
    '#0000FF', '#FF0000', '#008000', '#FF8C00', '#8B008B',
    '#00CED1', '#FFD700', '#FF1493', '#000080', '#006400',
    '#8B0000', '#4B0082', '#2F4F4F', '#FF4500', '#1E90FF',
  ],
  regionalPalette: ['#0000FF', '#FF0000', '#008000', '#FF8C00', '#8B008B', '#00CED1', '#FFD700', '#FF1493'],
  sequentialScale: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
  categoricalPalette: ['#0000FF', '#FF0000', '#008000', '#FF8C00', '#8B008B', '#00CED1', '#FFD700', '#FF1493'],
  noDataFill: '#eeeeee',
  neutralFill: '#cccccc',
  strokeColor: '#000000',
}
