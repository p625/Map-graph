import type { VisualizationPlugin } from '../types'
import { createEmptyColorMap } from '../contextUtils'

export const neutralPlugin: VisualizationPlugin = {
  id: 'neutral',
  name: 'Neutrální',
  description: 'Jednotná neutrální mapa bez dat',
  requiresDataset: false,
  requiresColumn: false,
  supportsColumn: () => false,
  resolveColors: (context) => createEmptyColorMap(context, context.theme.neutralFill),
  buildLegend: (context) => ({
    title: 'Neutrální zobrazení',
    items: [{ id: 'neutral', label: 'Bez obarvení', color: context.theme.neutralFill }],
  }),
}
