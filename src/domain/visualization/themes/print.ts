import type { VisualizationTheme } from './types'

export const printTheme: VisualizationTheme = {
  id: 'print',
  name: 'Tisk',
  description: 'Černobílá paleta vhodná pro tisk',
  workplacePalette: [
    '#1a1a1a', '#4d4d4d', '#737373', '#999999', '#b3b3b3',
    '#cccccc', '#333333', '#666666', '#808080', '#a6a6a6',
    '#262626', '#595959', '#8c8c8c', '#bfbfbf', '#d9d9d9',
  ],
  regionalPalette: ['#000000', '#404040', '#606060', '#808080', '#a0a0a0', '#c0c0c0', '#303030', '#505050'],
  sequentialScale: ['#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#404040'],
  categoricalPalette: ['#1a1a1a', '#4d4d4d', '#737373', '#999999', '#b3b3b3', '#333333', '#666666', '#808080'],
  noDataFill: '#f5f5f5',
  neutralFill: '#e5e5e5',
  strokeColor: '#ffffff',
}
