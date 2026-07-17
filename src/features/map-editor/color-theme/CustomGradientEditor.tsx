import { useMemo, useState } from 'react'
import { ColorInput } from '../../../components/config/ColorInput'
import { estimateColorContrast } from '../../../domain/color-themes/colorInterpolation'
import {
  findColorThemeById,
} from '../../../domain/color-themes/colorThemeRegistry'
import { getDatasetNumericRange } from '../../../domain/visualization/contextUtils'
import type { VisualizationContext } from '../../../domain/visualization/types'
import { useNotifications } from '../../../store/notificationStore'
import {
  CUSTOM_DRAFT_COLOR_THEME_ID,
  useCustomColorThemes,
} from '../../../store/customColorThemesStore'
import { useMapActions, useMapState } from '../../../store/mapStore'
import { GradientPreview } from './GradientPreview'
import { SaveColorThemeDialog } from './SaveColorThemeDialog'

interface CustomGradientEditorProps {
  context: VisualizationContext
}

export function CustomGradientEditor({ context }: CustomGradientEditorProps) {
  const { colorThemeId } = useMapState()
  const { setColorTheme } = useMapActions()
  const { notify } = useNotifications()
  const {
    customThemes,
    draftGradient,
    editingThemeId,
    editBaseline,
    setDraftGradient,
    saveNewTheme,
    updateTheme,
    renameTheme,
    findThemeByName,
    closeGradientEditor,
  } = useCustomColorThemes()

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')

  const draft = draftGradient ?? { minColor: '#dbeafe', maxColor: '#1e3a8a' }
  const datasetRange = useMemo(() => getDatasetNumericRange(context), [context])
  const lowContrast = estimateColorContrast(draft.minColor, draft.maxColor) < 0.12
  const editingTheme = editingThemeId ? findColorThemeById(editingThemeId, customThemes) : null
  const duplicateTheme = pendingName.trim()
    ? findThemeByName(pendingName)
    : undefined

  function updateDraft(minColor: string, maxColor: string) {
    const next = { minColor, maxColor }
    setDraftGradient(next)
    if (colorThemeId !== CUSTOM_DRAFT_COLOR_THEME_ID && !editingThemeId) {
      setColorTheme(CUSTOM_DRAFT_COLOR_THEME_ID)
    }
  }

  function handleSwap() {
    updateDraft(draft.maxColor, draft.minColor)
  }

  function handleSaveChanges() {
    if (!editingThemeId || !draftGradient) return
    updateTheme(editingThemeId, draftGradient)
    notify({ type: 'success', title: 'Barevné téma bylo uloženo', message: 'Změny gradientu byly zapsány.' })
  }

  function handleCancelChanges() {
    if (!editBaseline) return
    setDraftGradient({ ...editBaseline })
  }

  function handleSaveDialog(name: string, mode: 'create' | 'overwrite') {
    if (!draftGradient) return
    const trimmed = name.trim()
    const existing = findThemeByName(trimmed)

    if (mode === 'overwrite' && existing) {
      updateTheme(existing.id, draftGradient)
      if (existing.name !== trimmed) renameTheme(existing.id, trimmed)
      setColorTheme(existing.id)
      notify({ type: 'success', title: 'Barevné téma bylo uloženo', message: `Téma „${trimmed}“ bylo přepsáno.` })
    } else {
      const finalName =
        mode === 'create' && existing ? `${trimmed} (${new Date().toLocaleDateString('cs-CZ')})` : trimmed
      const theme = saveNewTheme(finalName, draftGradient)
      setColorTheme(theme.id)
      notify({ type: 'success', title: 'Barevné téma bylo uloženo', message: `Téma „${theme.name}“ je nyní aktivní.` })
    }

    setSaveDialogOpen(false)
    closeGradientEditor()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Vlastní barevná škála</h3>
      {editingTheme && (
        <p className="mt-1 text-xs text-slate-500">Úprava tématu: {editingTheme.name}</p>
      )}

      <GradientPreview
        stops={[
          { offset: 0, color: draft.minColor },
          { offset: 1, color: draft.maxColor },
        ]}
        className="mt-3 h-4 w-full rounded"
      />

      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Barva minima</p>
          <ColorInput
            label="Barva minima"
            value={draft.minColor}
            onChange={(minColor) => updateDraft(minColor, draft.maxColor)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Vybraná barva bude použita pro nejnižší hodnotu aktuálního datasetu.
          </p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Barva maxima</p>
          <ColorInput
            label="Barva maxima"
            value={draft.maxColor}
            onChange={(maxColor) => updateDraft(draft.minColor, maxColor)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Vybraná barva bude použita pro nejvyšší hodnotu aktuálního datasetu.
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt>Minimum datasetu</dt>
          <dd className="font-medium text-slate-900">
            {datasetRange.hasValues ? datasetRange.min : '—'}
          </dd>
        </div>
        <div>
          <dt>Maximum datasetu</dt>
          <dd className="font-medium text-slate-900">
            {datasetRange.hasValues ? datasetRange.max : '—'}
          </dd>
        </div>
      </dl>

      {lowContrast && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Barvy jsou si velmi podobné a hodnoty mohou být na mapě obtížně rozlišitelné.
        </p>
      )}

      <button
        type="button"
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        onClick={handleSwap}
      >
        Prohodit barvy
      </button>

      {editingThemeId ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleSaveChanges}
          >
            Uložit změny
          </button>
          <button
            type="button"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setSaveDialogOpen(true)}
          >
            Uložit jako nové téma
          </button>
          <button
            type="button"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            onClick={handleCancelChanges}
            disabled={!editBaseline}
          >
            Zrušit změny
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 w-full rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
          onClick={() => setSaveDialogOpen(true)}
        >
          Uložit jako barevné téma
        </button>
      )}

      <SaveColorThemeDialog
        open={saveDialogOpen}
        initialName={editingTheme?.name ?? ''}
        minColor={draft.minColor}
        maxColor={draft.maxColor}
        existingName={duplicateTheme?.name}
        onCancel={() => setSaveDialogOpen(false)}
        onSave={(name, mode) => {
          setPendingName(name)
          handleSaveDialog(name, mode)
        }}
      />
    </div>
  )
}
