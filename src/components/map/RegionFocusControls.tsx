import { useConfigData } from '../../store/configStore'
import { isOrganizationSynced } from '../../store/organizationStore'
import { useMapActions, useMapState } from '../../store/mapStore'

export function RegionFocusControls() {
  const { focusedRegionId, regionViewMode } = useMapState()
  const { setFocusedRegion, clearFocusedRegion } = useMapActions()
  const { regionalOffices, organizationSnapshot } = useConfigData()
  const synced = isOrganizationSynced(organizationSnapshot)

  const activeRegion = regionalOffices.find((region) => region.id === focusedRegionId)

  if (!synced) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Regionální focus vyžaduje synchronizovanou organizaci. Nejprve importujte{' '}
        <code className="rounded bg-white px-1">organizace.xlsx</code>.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Regionální focus</h3>
          <p className="mt-1 text-xs text-slate-500">
            {regionViewMode === 'focused' && activeRegion
              ? `Aktivní: ${activeRegion.name}`
              : 'Zobrazena celá ČR'}
          </p>
        </div>
        {focusedRegionId && (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => clearFocusedRegion()}
          >
            Celá ČR
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            !focusedRegionId
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => clearFocusedRegion()}
        >
          Celá ČR
        </button>
        {regionalOffices.map((region) => (
          <button
            key={region.id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              focusedRegionId === region.id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setFocusedRegion(region.id)}
          >
            {region.name}
          </button>
        ))}
      </div>
    </div>
  )
}
