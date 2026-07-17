import { ColorInput } from '../components/config/ColorInput'
import { ConfigToolbar } from '../components/config/ConfigToolbar'
import {
  defaultRegionColor,
  resolveRegionDisplayColor,
} from '../domain/color/regionDisplayColors'
import { isOrganizationSynced, useOrganizationSnapshot } from '../store/organizationStore'
import { useConfigData, useConfigDispatch, useConfigState } from '../store/configStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigRegionalColorsPage() {
  const snapshot = useOrganizationSnapshot()
  const { regionalOffices } = useConfigData()
  const { regionDisplayColors, workplaceRegionalAssignments } = useConfigState()
  const dispatch = useConfigDispatch()
  const { notify } = useNotifications()
  const synced = isOrganizationSynced(snapshot)

  const rows = regionalOffices.map((region) => {
    const workplaceCount = Object.values(workplaceRegionalAssignments).filter(
      (regionId) => regionId === region.id,
    ).length
    const districtCount = snapshot.districtAssignments.filter((assignment) => {
      const workplace = snapshot.workplaces.find((wp) => wp.id === assignment.workplaceId)
      return workplace?.regionId === region.id
    }).length
    return { region, workplaceCount, districtCount }
  })

  function handleColorChange(regionId: string, regionName: string, color: string) {
    dispatch({ type: 'set-region-color', regionId, color })
    notify({ type: 'info', title: 'Barva regionu', message: `${regionName}: ${color}` })
  }

  function handleReset(regionId: string, regionName: string) {
    dispatch({ type: 'reset-region-color', regionId })
    notify({ type: 'info', title: 'Barva resetována', message: `${regionName} — výchozí paleta` })
  }

  function handleResetAll() {
    dispatch({ type: 'reset-all-region-colors' })
    notify({
      type: 'success',
      title: 'Barvy resetovány',
      message: 'Všechny regiony používají výchozí paletu.',
    })
  }

  if (!synced) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Barvy regionů</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nejprve synchronizujte organizaci z Excelu.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Barvy regionů</h2>
          <p className="mt-1 text-sm text-slate-600">
            Barvy se používají pouze v mapovém režimu „Podle regionů“. Ostatní režimy je
            neovlivní. Změny se ukládají automaticky.
          </p>
        </div>
        <ConfigToolbar />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={handleResetAll}
        >
          Resetovat všechny barvy
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ region, workplaceCount, districtCount }) => {
          const hasCustom = Boolean(regionDisplayColors[region.id])
          const resolved = resolveRegionDisplayColor(region.id, region.name, regionDisplayColors)
          const fallback = defaultRegionColor(region.id, region.name)

          return (
            <div
              key={region.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{region.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {workplaceCount} pracovišť · {districtCount} okresů
                  </p>
                </div>
                <div
                  className="h-8 w-8 shrink-0 rounded-md border border-slate-200"
                  style={{ backgroundColor: resolved }}
                  title={resolved}
                />
              </div>
              <div className="mt-4 space-y-2">
                <ColorInput
                  value={hasCustom ? regionDisplayColors[region.id]! : fallback}
                  onChange={(color) => handleColorChange(region.id, region.name, color)}
                />
                {hasCustom && (
                  <button
                    type="button"
                    className="text-xs text-slate-600 underline"
                    onClick={() => handleReset(region.id, region.name)}
                  >
                    Resetovat na výchozí
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
