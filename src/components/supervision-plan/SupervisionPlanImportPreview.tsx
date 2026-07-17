import type {
  SupervisionPlanImportMode,
  SupervisionPlanImportPreview,
} from '../../domain/supervision-plan/io/supervision-plan-schema'

interface SupervisionPlanImportPreviewProps {
  preview: SupervisionPlanImportPreview
  mode: SupervisionPlanImportMode
  onModeChange: (mode: SupervisionPlanImportMode) => void
}

export function SupervisionPlanImportPreviewPanel({
  preview,
  mode,
  onModeChange,
}: SupervisionPlanImportPreviewProps) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Název plánu</dt>
          <dd className="font-medium text-slate-900">{preview.planName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Datum exportu</dt>
          <dd className="font-medium text-slate-900">
            {new Date(preview.exportedAt).toLocaleString('cs-CZ')}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Počet roků</dt>
          <dd className="font-medium text-slate-900">{preview.yearCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Počet přiřazení v souboru</dt>
          <dd className="font-medium text-slate-900">{preview.assignmentCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Importovatelných pracovišť</dt>
          <dd className="font-medium text-slate-900">{preview.importableAssignmentCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Naplánováno v importu</dt>
          <dd className="font-medium text-slate-900">{preview.plannedCount}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="font-medium text-slate-800">Porovnání s organizací</p>
        <ul className="mt-2 space-y-1 text-slate-700">
          <li>Shodná pracoviště: {preview.matchingWorkplaceIds.length}</li>
          <li>Neznámá workplaceId: {preview.unknownWorkplaceIds.length}</li>
          <li>Aktuální pracoviště chybějící v souboru: {preview.missingInImportWorkplaceIds.length}</li>
          <li>Roky k přidání: {preview.yearsToAdd.length > 0 ? preview.yearsToAdd.join(', ') : '—'}</li>
          <li>
            Roky ke změně:{' '}
            {preview.yearsToUpdate.length > 0
              ? preview.yearsToUpdate.map((y) => y.year).join(', ')
              : '—'}
          </li>
        </ul>
      </div>

      {preview.unknownWorkplaceIds.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer font-medium text-amber-900">
            Neznámá pracoviště ({preview.unknownWorkplaceIds.length})
          </summary>
          <ul className="mt-2 max-h-32 overflow-auto text-xs text-amber-900">
            {preview.unknownWorkplaceIds.map((item) => (
              <li key={item.workplaceId}>
                {item.workplaceId}
                {item.workplaceNameSnapshot ? ` — ${item.workplaceNameSnapshot}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      <fieldset className="space-y-2">
        <legend className="font-medium text-slate-800">Režim importu</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'replace'}
            onChange={() => onModeChange('replace')}
          />
          <span>
            <span className="font-medium">Nahradit současný plán</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Import nahradí roky a přiřazení. Chybějící aktuální pracoviště budou bez plánu.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'merge'}
            onChange={() => onModeChange('merge')}
          />
          <span>
            <span className="font-medium">Sloučit se současným plánem</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Import aktualizuje odpovídající pracoviště a roky. Ostatní zůstanou zachovány.
            </span>
          </span>
        </label>
      </fieldset>

      <p className="text-xs text-slate-600">
        {mode === 'replace'
          ? 'Import nahradí současný plán supervizí. Ostatní datasety, organizace a mapová nastavení zůstanou beze změny.'
          : 'Import aktualizuje odpovídající pracoviště a roky. Ostatní položky plánu zůstanou zachovány.'}
      </p>
    </div>
  )
}
