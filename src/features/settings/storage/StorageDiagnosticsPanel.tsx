import {
  buildStorageDiagnostics,
  formatStorageSize,
} from '../../../domain/persistence/storageDiagnostics'
import {
  crossDeviceSyncLabel,
  persistenceModeLabel,
} from '../../../domain/persistence/persistenceStatus'
import { useDatasetState } from '../../../store/datasetStore'

interface StorageDiagnosticsPanelProps {
  onExportWorkspace: () => void
  onImportWorkspace: () => void
}

export function StorageDiagnosticsPanel({
  onExportWorkspace,
  onImportWorkspace,
}: StorageDiagnosticsPanelProps) {
  const datasetState = useDatasetState()
  const diagnostics = buildStorageDiagnostics(datasetState)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Ukládání dat</h3>
        <p className="mt-1 text-sm text-slate-600">
          Data jsou uložena pouze v tomto prohlížeči. Na jiném počítači se automaticky neobjeví.
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Režim</dt>
          <dd className="font-medium text-slate-900">{persistenceModeLabel(diagnostics.mode)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Datasety</dt>
          <dd className="font-medium text-slate-900">{diagnostics.datasetCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Přibližná velikost</dt>
          <dd className="font-medium text-slate-900">
            {formatStorageSize(diagnostics.approximateBytes)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Poslední uložení datasetu</dt>
          <dd className="font-medium text-slate-900">
            {diagnostics.lastDatasetUpdateAt
              ? new Date(diagnostics.lastDatasetUpdateAt).toLocaleString('cs-CZ')
              : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Synchronizace mezi zařízeními</dt>
          <dd className="font-medium text-slate-900">{crossDeviceSyncLabel(diagnostics.mode)}</dd>
        </div>
      </dl>

      <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Velikost modulů v prohlížeči</p>
        <ul className="mt-2 space-y-1">
          {diagnostics.moduleSizes
            .filter((item) => item.bytes > 0)
            .map((item) => (
              <li key={item.key} className="flex justify-between gap-4">
                <span>{item.label}</span>
                <span className="font-mono">{formatStorageSize(item.bytes)}</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          onClick={onExportWorkspace}
        >
          Exportovat zálohu workspace
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          onClick={onImportWorkspace}
        >
          Importovat zálohu workspace
        </button>
      </div>
    </section>
  )
}
