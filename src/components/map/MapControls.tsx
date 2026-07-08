import { canUseDataVisualization } from '../../domain/dataset/datasetValidation'
import { visualizationRegistry } from '../../domain/visualization/VisualizationRegistry'
import { useActiveDataset, useDatasetState } from '../../store/datasetStore'
import { useMapActions, useMapState } from '../../store/mapStore'
import { MapGuardBanner } from './MapGuardBanner'
import { ThemeSelector } from './ThemeSelector'

export function MapControls() {
  const { pluginId, datasetId, columnKey } = useMapState()
  const { setPlugin, setDataset, setColumn } = useMapActions()
  const { datasets } = useDatasetState()
  const { dataset } = useActiveDataset(datasetId)
  const plugin = visualizationRegistry.getById(pluginId)

  const readyDatasets = datasets.filter((d) => d.status === 'ready')
  const availableColumns =
    dataset?.columns.filter((column) => plugin?.supportsColumn(column)) ?? []

  const dataVizBlocked =
    plugin?.requiresDataset && !canUseDataVisualization(pluginId, dataset?.status)

  return (
    <div className="space-y-4">
      <MapGuardBanner />

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Vizualizace</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={pluginId}
            onChange={(event) => setPlugin(event.target.value)}
          >
            {visualizationRegistry.getAll().map((item) => {
              const needsReady = item.requiresDataset
              const disabled = needsReady && readyDatasets.length === 0
              return (
                <option key={item.id} value={item.id} disabled={disabled}>
                  {item.name}
                  {disabled ? ' (vyžaduje dataset)' : ''}
                </option>
              )
            })}
          </select>
        </label>

        <ThemeSelector />

        {plugin?.requiresDataset && (
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Dataset</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={datasetId ?? ''}
              onChange={(event) => setDataset(event.target.value || null)}
            >
              <option value="">Vyberte dataset</option>
              {datasets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.status !== 'ready' ? ` (${item.status})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {plugin?.requiresColumn && (
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Sloupec</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
              value={columnKey ?? ''}
              disabled={dataVizBlocked}
              onChange={(event) => setColumn(event.target.value || null)}
            >
              <option value="">Vyberte sloupec</option>
              {availableColumns.map((column) => (
                <option key={column.id} value={column.key}>
                  {column.name} ({column.type})
                </option>
              ))}
            </select>
          </label>
        )}

        {!plugin?.requiresDataset && (
          <div className="text-sm text-slate-500 md:col-span-2">
            Organizační vizualizace používá konfiguraci pracovišť a regionů.
          </div>
        )}
      </div>
    </div>
  )
}
