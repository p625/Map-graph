import { useEffect, useState } from 'react'

interface WorkplaceLabelEditDialogProps {
  workplaceName: string
  initialText: string
  onSave: (text: string) => void
  onCancel: () => void
  onReset: () => void
}

export function WorkplaceLabelEditDialog({
  workplaceName,
  initialText,
  onSave,
  onCancel,
  onReset,
}: WorkplaceLabelEditDialogProps) {
  const [text, setText] = useState(initialText)

  useEffect(() => {
    setText(initialText)
  }, [initialText, workplaceName])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
        role="dialog"
        aria-labelledby="label-edit-title"
      >
        <h3 id="label-edit-title" className="text-sm font-semibold text-slate-900">
          Text popisku
        </h3>
        <p className="mt-1 text-xs text-slate-500">{workplaceName}</p>
        <p className="mt-2 text-xs text-slate-600">
          Nový řádek vložíte klávesou <kbd className="rounded border px-1">Enter</kbd>.
        </p>
        <textarea
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => onSave(text)}
          >
            Uložit
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            onClick={onCancel}
          >
            Zrušit
          </button>
          <button
            type="button"
            className="ml-auto text-sm text-slate-600 underline"
            onClick={onReset}
          >
            Reset textu
          </button>
        </div>
      </div>
    </div>
  )
}
