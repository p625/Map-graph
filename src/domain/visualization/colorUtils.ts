export const NEUTRAL_FILL = '#e5e7eb'
export const NO_DATA_FILL = '#f3f4f6'
export const DEFAULT_STROKE = '#ffffff'

export const WORKPLACE_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#be185d',
  '#4f46e5',
  '#0d9488',
  '#b45309',
  '#7c3aed',
  '#0369a1',
  '#15803d',
  '#c2410c',
]

export const REGIONAL_PALETTE = [
  '#1d4ed8',
  '#b91c1c',
  '#047857',
  '#a16207',
  '#6d28d9',
  '#0e7490',
  '#c2410c',
  '#9d174d',
]

export const SEQUENTIAL_SCALE = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a']

export const CATEGORICAL_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#be185d',
  '#4f46e5',
  '#0d9488',
]

export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function colorFromPalette(palette: string[], key: string): string {
  return palette[hashString(key) % palette.length] ?? palette[0]!
}

export function interpolateColor(
  min: number,
  max: number,
  value: number,
  scale: string[] = SEQUENTIAL_SCALE,
): string {
  if (!Number.isFinite(value) || min === max) {
    return scale[Math.floor(scale.length / 2)] ?? scale[0]!
  }

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const index = Math.round(ratio * (scale.length - 1))
  return scale[index]!
}

export function normalizeText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
