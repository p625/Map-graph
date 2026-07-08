import type { VisualizationTheme } from './types'

export const pastelTheme: VisualizationTheme = {
  id: 'pastel',
  name: 'Pastelová',
  description: 'Jemné barvy pro prezentace',
  workplacePalette: [
    '#A8D8EA', '#FFB6C1', '#B5EAD7', '#FFDAC1', '#C7CEEA',
    '#E2F0CB', '#FFD8BE', '#D4A5A5', '#9ADCFF', '#C9E4DE',
    '#F8EDEB', '#F6C6EA', '#B8E0D2', '#D6EADF', '#EAC4D5',
  ],
  regionalPalette: ['#A8D8EA', '#FFB6C1', '#B5EAD7', '#FFDAC1', '#C7CEEA', '#E2F0CB', '#FFD8BE', '#D4A5A5'],
  sequentialScale: ['#f7fbff', '#deebf7', '#9ecae1', '#4292c6', '#084594'],
  categoricalPalette: ['#A8D8EA', '#FFB6C1', '#B5EAD7', '#FFDAC1', '#C7CEEA', '#E2F0CB', '#FFD8BE', '#D4A5A5'],
  noDataFill: '#fafafa',
  neutralFill: '#f0f0f0',
  strokeColor: '#ffffff',
}
