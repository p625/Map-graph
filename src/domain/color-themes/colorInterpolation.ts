import type { MapColorStop } from './types'
import { LEGEND_GRADIENT_STEPS } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized
  const int = Number.parseInt(value, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function interpolateRgb(colorA: string, colorB: string, t: number): string {
  const ratio = clamp(t, 0, 1)
  const [r1, g1, b1] = hexToRgb(colorA)
  const [r2, g2, b2] = hexToRgb(colorB)
  return rgbToHex(
    Math.round(r1 + (r2 - r1) * ratio),
    Math.round(g1 + (g2 - g1) * ratio),
    Math.round(b1 + (b2 - b1) * ratio),
  )
}

function sortedStops(stops: MapColorStop[]): MapColorStop[] {
  return [...stops].sort((a, b) => a.offset - b.offset)
}

export function interpolateColorWithStops(
  min: number,
  max: number,
  value: number,
  stops: MapColorStop[],
): string {
  if (!Number.isFinite(value) || stops.length === 0) {
    return stops[Math.floor(stops.length / 2)]?.color ?? '#94a3b8'
  }

  const ordered = sortedStops(stops)
  const t = min === max ? 0.5 : clamp((value - min) / (max - min), 0, 1)

  if (ordered.length === 1) return ordered[0]!.color

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index]!
    const right = ordered[index + 1]!
    if (t >= left.offset && t <= right.offset) {
      const span = right.offset - left.offset
      const localT = span === 0 ? 0 : (t - left.offset) / span
      return interpolateRgb(left.color, right.color, localT)
    }
  }

  return t <= ordered[0]!.offset ? ordered[0]!.color : ordered[ordered.length - 1]!.color
}

export function buildSequentialScaleFromStops(
  stops: MapColorStop[],
  steps = LEGEND_GRADIENT_STEPS,
): string[] {
  const ordered = sortedStops(stops)
  if (ordered.length === 0) return ['#94a3b8']
  if (steps <= 1) return [ordered[0]!.color]

  const colors: string[] = []
  for (let index = 0; index < steps; index += 1) {
    const t = index / (steps - 1)
    colors.push(interpolateColorWithStops(0, 1, t, ordered))
  }
  return colors
}

export function scaleColorsFromSequentialScale(scale: string[]): MapColorStop[] {
  if (scale.length === 0) return [{ offset: 0, color: '#94a3b8' }, { offset: 1, color: '#1e3a8a' }]
  if (scale.length === 1) return [{ offset: 0, color: scale[0]! }, { offset: 1, color: scale[0]! }]
  return scale.map((color, index) => ({
    offset: index / (scale.length - 1),
    color,
  }))
}

/** Relative luminance contrast hint (0–1, higher = more different). */
export function estimateColorContrast(colorA: string, colorB: string): number {
  const [r1, g1, b1] = hexToRgb(colorA)
  const [r2, g2, b2] = hexToRgb(colorB)
  const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return Math.abs(lum(r1, g1, b1) - lum(r2, g2, b2))
}
