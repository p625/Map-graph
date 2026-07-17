import { useEffect, useState } from 'react'
import { GradientPreview } from './GradientPreview'
import { createTwoStopTheme } from '../../../domain/color-themes/types'

interface SaveColorThemeDialogProps {
  open: boolean
  initialName?: string
  minColor: string
  maxColor: string
  existingName?: string
  onCancel: () => void
  onSave: (name: string, mode: 'create' | 'overwrite') => void
}

export function SaveColorThemeDialog({
  open,
  initialName = '',
  minColor,
  maxColor,
  existingName,
  onCancel,
  onSave,
}: SaveColorThemeDialogProps) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  if (!open) return null

  const trimmed = name.trim()
  const hasDuplicate = Boolean(existingName && trimmed.toLowerCase() === existingName.toLowerCase())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-color-theme-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="save-color-theme-title" className="text-lg font-semibold text-slate-900">
          Uložit barevné téma
        </h3>
        <GradientPreview stops={createTwoStopTheme(minColor, maxColor).stops} className="mt-4 h-4 w-full rounded" />

        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Název tématu</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        {hasDuplicate && (
          <p className="mt-3 text-sm text-amber-800">
            Téma s tímto názvem již existuje. Můžete ho přepsat nebo uložit jako nové.
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={onCancel}
          >
            Zrušit
          </button>
          {hasDuplicate && (
            <button
              type="button"
              className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
              disabled={!trimmed}
              onClick={() => onSave(trimmed, 'overwrite')}
            >
              Přepsat
            </button>
          )}
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            disabled={!trimmed}
            onClick={() => onSave(trimmed, hasDuplicate ? 'create' : 'create')}
          >
            {hasDuplicate ? 'Uložit jako nové' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  )
}
