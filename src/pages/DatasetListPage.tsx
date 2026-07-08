import { Link } from 'react-router-dom'
import { datasetStatusLabel } from '../domain/dataset/datasetValidation'
import { useDatasetDispatch, useDatasetState } from '../store/datasetStore'
import { useNotifications } from '../store/notificationStore'

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  imported: 'bg-blue-100 text-blue-800',
  matched: 'bg-amber-100 text-amber-800',
  validated: 'bg-indigo-100 text-indigo-800',
  ready: 'bg-green-100 text-green-800',
}

export function DatasetListPage() {
  const { datasets } = useDatasetState()
  const dispatch = useDatasetDispatch()
  const { notify } = useNotifications()

  function handleRemove(id: string, name: string) {
    if (!confirm(`Opravdu smazat dataset „${name}"?`)) return
    dispatch({ type: 'remove-dataset', datasetId: id })
    notify({
      type: 'info',
      title: 'Dataset smazán',
      message: `Dataset „${name}" byl odstraněn.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Datasety</h2>
          <p className="mt-1 text-sm text-slate-600">
            Přehled importovaných datasetů a jejich stavu připravenosti.
          </p>
        </div>
        <Link
          to="/datasets/wizard"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nový dataset
        </Link>
      </div>

      {datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">Zatím nemáte žádné datasety.</p>
          <Link
            to="/datasets/wizard"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Spustit import wizard
          </Link>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700">Název</th>
                <th className="px-4 py-3 font-medium text-slate-700">Stav</th>
                <th className="px-4 py-3 font-medium text-slate-700">Řádky</th>
                <th className="px-4 py-3 font-medium text-slate-700">Párování</th>
                <th className="px-4 py-3 font-medium text-slate-700">Zdroj</th>
                <th className="px-4 py-3 font-medium text-slate-700">Import</th>
                <th className="px-4 py-3 font-medium text-slate-700" />
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr key={dataset.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{dataset.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[dataset.status] ?? 'bg-slate-100'}`}
                    >
                      {datasetStatusLabel(dataset.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{dataset.recordCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {dataset.matchedCount}/{dataset.recordCount}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{dataset.source}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(dataset.importedAt).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => handleRemove(dataset.id, dataset.name)}
                    >
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
