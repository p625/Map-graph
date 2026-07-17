import { useRef, useState } from 'react'
import {
  buildSupervisionPlanImportPreview,
  parseSupervisionPlanImportJson,
} from '../../domain/supervision-plan/io/supervision-plan-import'
import type { SupervisionPlan } from '../../domain/supervision-plan/types'
import type {
  SupervisionPlanImportMode,
  SupervisionPlanImportPreview,
} from '../../domain/supervision-plan/io/supervision-plan-schema'
import { SupervisionPlanImportPreviewPanel } from './SupervisionPlanImportPreview'

interface SupervisionPlanImportDialogProps {
  open: boolean
  currentPlan: SupervisionPlan
  activeWorkplaceIds: string[]
  onClose: () => void
  onConfirm: (preview: SupervisionPlanImportPreview, mode: SupervisionPlanImportMode) => void
}

export function SupervisionPlanImportDialog({
  open,
  currentPlan,
  activeWorkplaceIds,
  onClose,
  onConfirm,
}: SupervisionPlanImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SupervisionPlanImportPreview | null>(null)
  const [mode, setMode] = useState<SupervisionPlanImportMode>('replace')
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  if (!open) return null

  function resetState() {
    setPreview(null)
    setErrors([])
    setMode('replace')
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleFileSelected(file: File | null) {
    setErrors([])
    setPreview(null)
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      const parsed = parseSupervisionPlanImportJson(text)
      if (!parsed.ok || !parsed.data) {
        setErrors(parsed.errors.map((item) => item.message))
        return
      }
      const nextPreview = buildSupervisionPlanImportPreview(parsed.data, currentPlan, activeWorkplaceIds)
      setPreview(nextPreview)
    } catch {
      setErrors(['Soubor se nepodařilo načíst.'])
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!preview) return
    onConfirm(preview, mode)
    resetState()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supervision-import-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="supervision-import-title" className="text-lg font-semibold text-slate-900">
              Importovat plán supervizí
            </h3>
            <p className="mt-1 text-sm text-slate-600">Vyberte JSON soubor exportovaný z této aplikace.</p>
          </div>
          <button type="button" className="text-slate-500 hover:text-slate-800" onClick={handleClose}>
            ✕
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="block w-full text-sm"
          onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
        />

        {loading && <p className="mt-3 text-sm text-slate-600">Načítám soubor…</p>}

        {errors.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">Import nelze pokračovat:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {preview && (
          <div className="mt-4">
            <SupervisionPlanImportPreviewPanel preview={preview} mode={mode} onModeChange={setMode} />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={handleClose}
          >
            Zrušit
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            disabled={!preview}
            onClick={handleConfirm}
          >
            Importovat
          </button>
        </div>
      </div>
    </div>
  )
}
