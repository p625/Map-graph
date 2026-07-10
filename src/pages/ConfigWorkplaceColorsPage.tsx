import { useMemo, useState } from 'react'
import { ColorInput } from '../components/config/ColorInput'
import { ConfigToolbar } from '../components/config/ConfigToolbar'
import { WorkplaceAssignmentFiltersBar } from '../components/config/WorkplaceAssignmentFiltersBar'
import {
  defaultWorkplaceColor,
  resolveWorkplaceDisplayColor,
} from '../domain/color/workplaceDisplayColors'
import {
  defaultWorkplaceFilters,
  filterWorkplaces,
} from '../domain/organization/workplaceAssignmentUi'
import { isOrganizationSynced, useOrganizationSnapshot } from '../store/organizationStore'
import { useConfigData, useConfigDispatch, useConfigState } from '../store/configStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigWorkplaceColorsPage() {
  const snapshot = useOrganizationSnapshot()
  const { workplaces } = useConfigData()
  const { workplaceDisplayColors } = useConfigState()
  const dispatch = useConfigDispatch()
  const { notify } = useNotifications()
  const synced = isOrganizationSynced(snapshot)

  const [filters, setFilters] = useState(defaultWorkplaceFilters)

  const orgUnitById = useMemo(
    () => new Map(snapshot.orgUnits.map((unit) => [unit.id, unit])),
    [snapshot.orgUnits],
  )

  const rows = useMemo(() => {
    const filtered = filterWorkplaces(snapshot, filters)
    return filtered.filter(({ workplace }) => workplaces.some((wp) => wp.id === workplace.id))
  }, [snapshot, filters, workplaces])

  function handleColorChange(workplaceId: string, workplaceName: string, color: string) {
    dispatch({ type: 'set-workplace-color', workplaceId, color })
    notify({ type: 'info', title: 'Barva pracoviště', message: `${workplaceName}: ${color}` })
  }

  function handleReset(workplaceId: string, workplaceName: string) {
    dispatch({ type: 'reset-workplace-color', workplaceId })
    notify({ type: 'info', title: 'Barva resetována', message: `${workplaceName} — výchozí paleta` })
  }

  function handleResetAll() {
    dispatch({ type: 'reset-all-workplace-colors' })
    notify({
      type: 'success',
      title: 'Barvy resetovány',
      message: 'Všechna pracoviště používají výchozí paletu.',
    })
  }

  if (!synced) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Barvy pracovišť</h2>
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
          <h2 className="text-2xl font-semibold text-slate-900">Barvy pracovišť</h2>
          <p className="mt-1 text-sm text-slate-600">
            Barvy se používají pouze v mapovém režimu „Podle pracovišť“. Ostatní režimy je
            neovlivní.
          </p>
        </div>
        <ConfigToolbar />
      </div>

      <WorkplaceAssignmentFiltersBar filters={filters} onChange={setFilters} snapshot={snapshot} />

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={handleResetAll}
        >
          Reset všech na výchozí paletu
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Pracoviště</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Vedoucí</th>
              <th className="px-4 py-3 text-right">Okresů</th>
              <th className="px-4 py-3">Barva</th>
              <th className="px-4 py-3">Zdroj</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ workplace, districtCount }) => {
              const hasCustom = Boolean(workplaceDisplayColors[workplace.id])
              const resolved = resolveWorkplaceDisplayColor(
                workplace.id,
                workplace.name,
                workplaceDisplayColors,
              )
              const defaultColor = defaultWorkplaceColor(workplace.id, workplace.name)
              const region = snapshot.regions.find((item) => item.id === workplace.regionId)
              const leader = snapshot.leaders.find((item) => item.id === workplace.leaderId)
              const orgUnit = orgUnitById.get(workplace.orgUnitId)

              return (
                <tr key={workplace.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{workplace.name}</td>
                  <td className="px-4 py-3 text-slate-600">{region?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {leader?.name ?? '—'}
                    {orgUnit && (
                      <span className="ml-1 text-xs text-slate-400">({orgUnit.designation})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{districtCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-6 w-6 rounded border border-slate-200"
                        style={{ backgroundColor: resolved }}
                      />
                      <ColorInput
                        value={hasCustom ? workplaceDisplayColors[workplace.id]! : resolved}
                        onChange={(color) => handleColorChange(workplace.id, workplace.name, color)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {hasCustom ? 'Vlastní' : `Výchozí (${defaultColor})`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasCustom && (
                      <button
                        type="button"
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => handleReset(workplace.id, workplace.name)}
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
