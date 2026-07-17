import { isValidMapColor, normalizeHexColor } from '../color/mapColorValidation'
import type { MapColorStop, MapColorTheme } from './types'
import { MAX_COLOR_THEME_NAME_LENGTH } from './types'

export function sanitizeColorThemeName(name: string): string {
  return name.trim().slice(0, MAX_COLOR_THEME_NAME_LENGTH)
}

export function sanitizeColorStops(stops: MapColorStop[]): MapColorStop[] | null {
  if (!Array.isArray(stops) || stops.length < 2) return null

  const normalized: MapColorStop[] = []
  for (const stop of stops) {
    if (typeof stop.offset !== 'number' || !Number.isFinite(stop.offset)) return null
    if (stop.offset < 0 || stop.offset > 1) return null
    const color = normalizeHexColor(stop.color)
    if (!color) return null
    normalized.push({ offset: stop.offset, color })
  }

  normalized.sort((a, b) => a.offset - b.offset)
  if (normalized[0]!.offset !== 0 || normalized[normalized.length - 1]!.offset !== 1) {
    return null
  }

  return normalized
}

export function sanitizeCustomColorTheme(raw: unknown): MapColorTheme | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<MapColorTheme>
  if (typeof item.id !== 'string' || !item.id.startsWith('custom-gradient-')) return null
  const name = sanitizeColorThemeName(typeof item.name === 'string' ? item.name : '')
  if (!name) return null
  const stops = sanitizeColorStops(Array.isArray(item.stops) ? item.stops : [])
  if (!stops) return null

  return {
    id: item.id,
    name,
    source: 'custom',
    scaleType: 'continuous',
    stops,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
  }
}

export function validateDraftColors(minColor: string, maxColor: string): boolean {
  return isValidMapColor(minColor) && isValidMapColor(maxColor)
}

export function createCustomColorThemeId(): string {
  return `custom-gradient-${crypto.randomUUID()}`
}
