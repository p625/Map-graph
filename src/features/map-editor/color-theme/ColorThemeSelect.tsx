import { useMemo, useState } from 'react'
import {
  draftFromColorTheme,
  draftFromVisualizationThemeId,
  findColorThemeById,
  getBuiltinColorThemes,
  getFallbackColorThemeId,
} from '../../../domain/color-themes/colorThemeRegistry'
import { CUSTOM_DRAFT_COLOR_THEME_ID } from '../../../domain/color-themes/types'
import { defaultThemeId } from '../../../domain/visualization/themes'
import { useNotifications } from '../../../store/notificationStore'
import {
  useCustomColorThemes,
} from '../../../store/customColorThemesStore'
import { useMapActions, useMapState } from '../../../store/mapStore'
import { GradientPreview } from './GradientPreview'

const CUSTOM_OPTION_VALUE = CUSTOM_DRAFT_COLOR_THEME_ID

export function ColorThemeSelect() {
  const { colorThemeId, themeId } = useMapState()
  const { setColorTheme } = useMapActions()
  const { notify } = useNotifications()
  const {
    customThemes,
    openDraftEditor,
    openEditTheme,
    deleteTheme,
    renameTheme,
    duplicateTheme,
    closeGradientEditor,
  } = useCustomColorThemes()
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const builtinThemes = useMemo(() => getBuiltinColorThemes(), [])
  const selectValue =
    colorThemeId === CUSTOM_DRAFT_COLOR_THEME_ID ? CUSTOM_OPTION_VALUE : colorThemeId

  function handleSelect(value: string) {
    if (value === CUSTOM_OPTION_VALUE) {
      const existing = findColorThemeById(colorThemeId, customThemes)
      const initial = existing
        ? draftFromColorTheme(existing)
        : draftFromVisualizationThemeId(themeId)
      openDraftEditor(initial)
      setColorTheme(CUSTOM_DRAFT_COLOR_THEME_ID)
      return
    }

    closeGradientEditor()
    setColorTheme(value)
  }

  function handleDelete(themeIdToDelete: string) {
    const theme = findColorThemeById(themeIdToDelete, customThemes)
    if (!theme) return
    if (!window.confirm(`Odstranit barevné téma „${theme.name}“?`)) return
    deleteTheme(themeIdToDelete)
    if (colorThemeId === themeIdToDelete) {
      setColorTheme(getFallbackColorThemeId())
      notify({
        type: 'info',
        title: 'Barevné téma odstraněno',
        message: 'Aktivní téma bylo přepnuto na výchozí.',
      })
    }
  }

  function handleRenameSubmit() {
    if (!renameId) return
    const renamed = renameTheme(renameId, renameValue)
    if (renamed) {
      notify({ type: 'success', title: 'Téma přejmenováno', message: renamed.name })
    }
    setRenameId(null)
    setRenameValue('')
  }

  return (
    <div className="space-y-2 text-sm">
      <label className="block space-y-1">
        <span className="font-medium text-slate-700">Barevná škála</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={selectValue}
          onChange={(event) => handleSelect(event.target.value)}
        >
          <optgroup label="Vestavěná témata">
            {builtinThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </optgroup>
          {customThemes.length > 0 && (
            <optgroup label="Vlastní témata">
              {customThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </optgroup>
          )}
          <option value={CUSTOM_OPTION_VALUE}>Vlastní…</option>
        </select>
      </label>

      <div className="space-y-2">
        {customThemes.map((theme) => (
          <div
            key={theme.id}
            className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
          >
            <GradientPreview stops={theme.stops} className="h-3 w-10 shrink-0 rounded" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{theme.name}</span>
            <button
              type="button"
              className="text-xs text-blue-700 hover:underline"
              onClick={() => {
                setColorTheme(theme.id)
                openEditTheme(theme.id)
              }}
            >
              Upravit
            </button>
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={() => {
                setRenameId(theme.id)
                setRenameValue(theme.name)
              }}
            >
              Přejmenovat
            </button>
            <button
              type="button"
              className="text-xs text-slate-600 hover:underline"
              onClick={() => {
                const copy = duplicateTheme(theme.id, `${theme.name} (kopie)`)
                if (copy) setColorTheme(copy.id)
              }}
            >
              Duplikovat
            </button>
            <button
              type="button"
              className="text-xs text-red-700 hover:underline"
              onClick={() => handleDelete(theme.id)}
            >
              Odstranit
            </button>
          </div>
        ))}
      </div>

      {renameId && (
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-slate-700">Nový název</span>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs"
              onClick={() => setRenameId(null)}
            >
              Zrušit
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
              onClick={handleRenameSubmit}
            >
              Uložit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { defaultThemeId }
