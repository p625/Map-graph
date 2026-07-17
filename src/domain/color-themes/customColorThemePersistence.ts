import { loadJson, saveJson } from '../../utils/storage'
import { sanitizeCustomColorTheme } from './customColorThemeSchema'
import { CUSTOM_COLOR_THEMES_STORAGE_KEY, type MapColorTheme } from './types'

export interface CustomColorThemesStorage {
  version: 1
  themes: MapColorTheme[]
}

export function loadCustomColorThemes(): MapColorTheme[] {
  const stored = loadJson<CustomColorThemesStorage | MapColorTheme[] | null>(
    CUSTOM_COLOR_THEMES_STORAGE_KEY,
    null,
  )
  if (!stored) return []

  const rawThemes = Array.isArray(stored) ? stored : stored.themes
  if (!Array.isArray(rawThemes)) return []

  const seen = new Set<string>()
  const themes: MapColorTheme[] = []
  for (const item of rawThemes) {
    const sanitized = sanitizeCustomColorTheme(item)
    if (!sanitized || seen.has(sanitized.id)) continue
    seen.add(sanitized.id)
    themes.push(sanitized)
  }
  return themes
}

export function saveCustomColorThemes(themes: MapColorTheme[]): void {
  const payload: CustomColorThemesStorage = {
    version: 1,
    themes: themes.filter((theme) => theme.source === 'custom'),
  }
  saveJson(CUSTOM_COLOR_THEMES_STORAGE_KEY, payload)
}
