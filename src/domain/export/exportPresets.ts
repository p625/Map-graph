export type ExportPresetId =
  | 'presentation-16-9'
  | 'a4-landscape'
  | 'a4-portrait'
  | 'custom'

export type ExportQuality = 'standard' | 'high'

export interface ExportPreset {
  id: ExportPresetId
  name: string
  width: number
  height: number
  description: string
}

export const exportPresets: ExportPreset[] = [
  {
    id: 'presentation-16-9',
    name: '16:9 prezentace',
    width: 1920,
    height: 1080,
    description: 'Full HD slide pro PowerPoint',
  },
  {
    id: 'a4-landscape',
    name: 'A4 na šířku',
    width: 3508,
    height: 2480,
    description: 'A4 landscape při 300 DPI',
  },
  {
    id: 'a4-portrait',
    name: 'A4 na výšku',
    width: 2480,
    height: 3508,
    description: 'A4 portrait při 300 DPI',
  },
  {
    id: 'custom',
    name: 'Vlastní velikost',
    width: 1200,
    height: 800,
    description: 'Vlastní rozměry v pixelech',
  },
]

export function getExportPreset(id: ExportPresetId): ExportPreset {
  return exportPresets.find((p) => p.id === id) ?? exportPresets[0]!
}

export function resolveExportDimensions(
  presetId: ExportPresetId,
  customWidth: number,
  customHeight: number,
): { width: number; height: number } {
  if (presetId === 'custom') {
    return {
      width: Math.max(400, Math.min(8000, customWidth)),
      height: Math.max(300, Math.min(8000, customHeight)),
    }
  }
  const preset = getExportPreset(presetId)
  return { width: preset.width, height: preset.height }
}

export function getExportPixelRatio(quality: ExportQuality): number {
  return quality === 'high' ? 3 : 2
}
