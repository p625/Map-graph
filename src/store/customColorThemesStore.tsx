import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createCustomColorThemeId,
  sanitizeColorThemeName,
} from '../domain/color-themes/customColorThemeSchema'
import {
  loadCustomColorThemes,
  saveCustomColorThemes,
} from '../domain/color-themes/customColorThemePersistence'
import {
  canDeleteColorTheme,
  draftFromColorTheme,
  findColorThemeById,
  type ColorThemeDraft,
} from '../domain/color-themes/colorThemeRegistry'
import {
  createTwoStopTheme,
  CUSTOM_DRAFT_COLOR_THEME_ID,
  type MapColorTheme,
} from '../domain/color-themes/types'

interface CustomColorThemesContextValue {
  customThemes: MapColorTheme[]
  draftGradient: ColorThemeDraft | null
  editingThemeId: string | null
  editBaseline: ColorThemeDraft | null
  isGradientEditorOpen: boolean
  setDraftGradient: (draft: ColorThemeDraft | null) => void
  openDraftEditor: (initial: ColorThemeDraft) => void
  openEditTheme: (themeId: string) => void
  closeGradientEditor: () => void
  saveNewTheme: (name: string, draft: ColorThemeDraft) => MapColorTheme
  updateTheme: (themeId: string, draft: ColorThemeDraft) => MapColorTheme | null
  renameTheme: (themeId: string, name: string) => MapColorTheme | null
  duplicateTheme: (themeId: string, name: string) => MapColorTheme | null
  deleteTheme: (themeId: string) => boolean
  findThemeByName: (name: string) => MapColorTheme | undefined
}

const CustomColorThemesContext = createContext<CustomColorThemesContextValue | null>(null)

export function CustomColorThemesProvider({ children }: { children: ReactNode }) {
  const [customThemes, setCustomThemes] = useState<MapColorTheme[]>(() => loadCustomColorThemes())
  const [draftGradient, setDraftGradient] = useState<ColorThemeDraft | null>(null)
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [editBaseline, setEditBaseline] = useState<ColorThemeDraft | null>(null)
  const [isGradientEditorOpen, setIsGradientEditorOpen] = useState(false)

  useEffect(() => {
    saveCustomColorThemes(customThemes)
  }, [customThemes])

  const persistThemes = useCallback((next: MapColorTheme[]) => {
    setCustomThemes(next)
  }, [])

  const value = useMemo<CustomColorThemesContextValue>(
    () => ({
      customThemes,
      draftGradient,
      editingThemeId,
      editBaseline,
      isGradientEditorOpen,
      setDraftGradient,
      openDraftEditor: (initial) => {
        setDraftGradient(initial)
        setEditingThemeId(null)
        setEditBaseline(null)
        setIsGradientEditorOpen(true)
      },
      openEditTheme: (themeId) => {
        const theme = findColorThemeById(themeId, customThemes)
        if (!theme || theme.source !== 'custom') return
        const baseline = draftFromColorTheme(theme)
        setDraftGradient(baseline)
        setEditBaseline(baseline)
        setEditingThemeId(themeId)
        setIsGradientEditorOpen(true)
      },
      closeGradientEditor: () => {
        setIsGradientEditorOpen(false)
        setDraftGradient(null)
        setEditingThemeId(null)
        setEditBaseline(null)
      },
      saveNewTheme: (name, draft) => {
        const now = new Date().toISOString()
        const theme: MapColorTheme = {
          id: createCustomColorThemeId(),
          name: sanitizeColorThemeName(name),
          source: 'custom',
          ...createTwoStopTheme(draft.minColor, draft.maxColor),
          createdAt: now,
          updatedAt: now,
        }
        persistThemes([theme, ...customThemes])
        return theme
      },
      updateTheme: (themeId, draft) => {
        const existing = customThemes.find((theme) => theme.id === themeId)
        if (!existing) return null
        const updated: MapColorTheme = {
          ...existing,
          ...createTwoStopTheme(draft.minColor, draft.maxColor),
          updatedAt: new Date().toISOString(),
        }
        persistThemes(customThemes.map((theme) => (theme.id === themeId ? updated : theme)))
        return updated
      },
      renameTheme: (themeId, name) => {
        const existing = customThemes.find((theme) => theme.id === themeId)
        if (!existing) return null
        const updated: MapColorTheme = {
          ...existing,
          name: sanitizeColorThemeName(name),
          updatedAt: new Date().toISOString(),
        }
        persistThemes(customThemes.map((theme) => (theme.id === themeId ? updated : theme)))
        return updated
      },
      duplicateTheme: (themeId, name) => {
        const existing = customThemes.find((theme) => theme.id === themeId)
        if (!existing) return null
        const now = new Date().toISOString()
        const copy: MapColorTheme = {
          ...existing,
          id: createCustomColorThemeId(),
          name: sanitizeColorThemeName(name),
          createdAt: now,
          updatedAt: now,
        }
        persistThemes([copy, ...customThemes])
        return copy
      },
      deleteTheme: (themeId) => {
        if (!canDeleteColorTheme(themeId)) return false
        persistThemes(customThemes.filter((theme) => theme.id !== themeId))
        return true
      },
      findThemeByName: (name) => {
        const normalized = sanitizeColorThemeName(name).toLowerCase()
        return customThemes.find((theme) => theme.name.toLowerCase() === normalized)
      },
    }),
    [
      customThemes,
      draftGradient,
      editingThemeId,
      editBaseline,
      isGradientEditorOpen,
      persistThemes,
    ],
  )

  return (
    <CustomColorThemesContext.Provider value={value}>{children}</CustomColorThemesContext.Provider>
  )
}

export function useCustomColorThemes(): CustomColorThemesContextValue {
  const context = useContext(CustomColorThemesContext)
  if (!context) {
    throw new Error('useCustomColorThemes must be used within CustomColorThemesProvider')
  }
  return context
}

export { CUSTOM_DRAFT_COLOR_THEME_ID }
