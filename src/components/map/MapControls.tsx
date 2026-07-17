import { useEffect } from 'react'
import {
  canUseDataVisualization,
  canUseOrganizationVisualization,
} from '../../domain/dataset/datasetValidation'
import { visualizationRegistry } from '../../domain/visualization/VisualizationRegistry'
import { useActiveDataset, useDatasetState } from '../../store/datasetStore'
import { useConfigData } from '../../store/configStore'
import { isOrganizationSynced } from '../../store/organizationStore'
import { useMapActions, useMapState } from '../../store/mapStore'
import { useSupervisionPlan } from '../../store/supervisionPlanStore'
import type { SupervisionYearFilter } from '../../domain/supervision-plan/types'
import { MapGuardBanner } from './MapGuardBanner'
import { ColorThemeSelect } from '../../features/map-editor/color-theme/ColorThemeSelect'
import { ThemeSelector } from './ThemeSelector'

export function MapControls() {
  const { pluginId, datasetId, columnKey, supervisionYearFilter } = useMapState()
  const { setPlugin, setDataset, setColumn, setSupervisionYearFilter } = useMapActions()
  const { datasets } = useDatasetState()
  const { dataset } = useActiveDataset(datasetId)
  const { organizationSnapshot } = useConfigData()
  const orgSynced = isOrganizationSynced(organizationSnapshot)
  const plugin = visualizationRegistry.getById(pluginId)

  const readyDatasets = datasets.filter((d) => d.status === 'ready')
  const availableColumns =
    dataset?.columns.filter((column) => plugin?.supportsColumn(column)) ?? []

  const dataVizBlocked =
    plugin?.requiresDataset && !canUseDataVisualization(pluginId, dataset?.status)

  const orgVizBlocked =
    plugin?.requiresOrganization && !canUseOrganizationVisualization(pluginId, orgSynced)
  const supervisionPlan = useSupervisionPlan()

  useEffect(() => {
    if (datasetId && !datasets.some((item) => item.id === datasetId)) {
      setDataset(null)
    }
  }, [datasetId, datasets, setDataset])

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
              const needsOrg = item.requiresOrganization
              const disabled =
                (needsReady && readyDatasets.length === 0) ||
                (needsOrg && !orgSynced)
              return (
                <option key={item.id} value={item.id} disabled={disabled}>
                  {item.name}
                  {needsReady && readyDatasets.length === 0 ? ' (vyžaduje dataset)' : ''}
                  {needsOrg && !orgSynced ? ' (vyžaduje sync organizace)' : ''}
                </option>
              )
            })}
          </select>
        </label>

        {pluginId === 'choropleth' ? <ColorThemeSelect /> : <ThemeSelector />}

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
            {orgVizBlocked
              ? pluginId === 'supervision-plan'
                ? 'Synchronizujte organizaci pro plán supervizí.'
                : 'Synchronizujte organizaci pro režim podle vedoucích.'
              : pluginId === 'supervision-plan'
                ? 'Pracoviště jsou obarvena podle plánovaného roku supervize.'
                : 'Organizační vizualizace používá konfiguraci pracovišť, regionů a barev.'}
          </div>
        )}

        {pluginId === 'supervision-plan' && orgSynced && (
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Zobrazit rok</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={
                supervisionYearFilter === 'all' || supervisionYearFilter === 'unplanned'
                  ? supervisionYearFilter
                  : String(supervisionYearFilter)
              }
              onChange={(event) => {
                const value = event.target.value
                const filter: SupervisionYearFilter =
                  value === 'all' || value === 'unplanned' ? value : Number(value)
                setSupervisionYearFilter(filter)
              }}
            >
              <option value="all">Všechny roky</option>
              {supervisionPlan.years
                .filter((y) => y.isActive)
                .map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}
                  </option>
                ))}
              <option value="unplanned">Bez plánu</option>
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
