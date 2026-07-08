import type { VisualizationTheme } from './types'

export const colorblindTheme: VisualizationTheme = {
  id: 'colorblind',
  name: 'Pro barvoslabé',
  description: 'Paleta optimalizovaná pro barvoslabost',
  workplacePalette: [
    '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9',
    '#F0E442', '#D55E00', '#000000', '#882255', '#44AA99',
    '#117733', '#999933', '#AA4499', '#332288', '#88CCEE',
  ],
  regionalPalette: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#F0E442', '#000000'],
  sequentialScale: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
  categoricalPalette: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00', '#56B4E9', '#F0E442', '#000000'],
  noDataFill: '#f0f0f0',
  neutralFill: '#d9d9d9',
  strokeColor: '#ffffff',
}
