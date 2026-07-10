import type { VisualizationTheme } from './types'

export const classicTheme: VisualizationTheme = {
  id: 'classic',
  name: 'Klasická',
  description: 'Výchozí paleta pro běžné použití',
  workplacePalette: [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
    '#0891b2', '#ea580c', '#be185d', '#4f46e5', '#0d9488',
    '#b45309', '#7c3aed', '#0369a1', '#15803d', '#c2410c',
  ],
  regionalPalette: ['#1d4ed8', '#b91c1c', '#047857', '#a16207', '#6d28d9', '#0e7490', '#c2410c', '#9d174d'],
  sequentialScale: [
    '#dbeafe', '#bfdbfe', '#93c5fd', '#7dd3fc', '#60a5fa',
    '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554',
  ],
  categoricalPalette: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#be185d'],
  noDataFill: '#f3f4f6',
  neutralFill: '#e5e7eb',
  strokeColor: '#ffffff',
}
