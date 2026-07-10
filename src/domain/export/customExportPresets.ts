import type { ExportMapScope } from '../region/types'
import type { MapSizeMode } from './exportMapLayout'
import type { ExportQuality } from './exportPresets'
import { loadJson, saveJson } from '../../utils/storage'

export interface CustomExportPreset {
  id: string
  name: string
  width: number
  height: number
  mapSizeMode: MapSizeMode
  mapWidthPercent: number
  mapHeightPercent: number
  showTitle: boolean
  showSubtitle: boolean
  showLegend: boolean
  showOrganizationLegend: boolean
  showDatasetInfo: boolean
  exportScope: ExportMapScope
  quality: ExportQuality
  createdAt: string
  updatedAt: string
}

export const CUSTOM_EXPORT_PRESETS_KEY = 'map-graph-export-presets-v1'

const MIN_DIMENSION = 400
const MAX_DIMENSION = 8000

export function sanitizeDimension(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, parsed)))
}

export function sanitizePercent(value: unknown, fallback = 85): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(Math.min(100, Math.max(50, parsed)))
}

export function sanitizeCustomExportPreset(raw: unknown): CustomExportPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<CustomExportPreset>
  const id = String(item.id ?? '')
  const name = String(item.name ?? '').trim()
  if (!id || !name) return null

  const mapSizeMode =
    item.mapSizeMode === 'balanced' || item.mapSizeMode === 'custom' || item.mapSizeMode === 'maximum'
      ? item.mapSizeMode
      : 'maximum'

  const now = new Date().toISOString()
  const mapWidthPercent = sanitizePercent(item.mapWidthPercent, 85)

  return {
    id,
    name,
    width: sanitizeDimension(item.width, 1920),
    height: sanitizeDimension(item.height, 1080),
    mapSizeMode,
    mapWidthPercent,
    mapHeightPercent: sanitizePercent(item.mapHeightPercent, mapWidthPercent),
    showTitle: item.showTitle !== false,
    showSubtitle: item.showSubtitle !== false,
    showLegend: item.showLegend !== false,
    showOrganizationLegend: Boolean(item.showOrganizationLegend),
    showDatasetInfo: item.showDatasetInfo !== false,
    exportScope: item.exportScope === 'focused-region' ? 'focused-region' : 'country',
    quality: item.quality === 'high' ? 'high' : 'standard',
    createdAt: String(item.createdAt ?? now),
    updatedAt: String(item.updatedAt ?? now),
  }
}

export function loadCustomExportPresets(): CustomExportPreset[] {
  const stored = loadJson<unknown>(CUSTOM_EXPORT_PRESETS_KEY, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map((item) => sanitizeCustomExportPreset(item))
    .filter((item): item is CustomExportPreset => Boolean(item))
}

export function saveCustomExportPresets(presets: CustomExportPreset[]): void {
  saveJson(CUSTOM_EXPORT_PRESETS_KEY, presets)
}

export function createCustomExportPreset(
  partial: Omit<CustomExportPreset, 'id' | 'createdAt' | 'updatedAt'> & { name: string },
): CustomExportPreset {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

export function isBuiltinPresetKey(key: string): boolean {
  return (
    key === 'presentation-16-9' ||
    key === 'a4-landscape' ||
    key === 'a4-portrait' ||
    key === 'custom'
  )
}

export function customPresetKey(id: string): string {
  return `custom:${id}`
}

export function parsePresetKey(key: string): { kind: 'builtin' | 'custom'; id: string } {
  if (key.startsWith('custom:')) {
    return { kind: 'custom', id: key.slice('custom:'.length) }
  }
  return { kind: 'builtin', id: key }
}
