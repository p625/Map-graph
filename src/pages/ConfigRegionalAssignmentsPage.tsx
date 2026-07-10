import { useMemo, useState } from 'react'
import { AssignmentToolbar } from '../components/config/AssignmentToolbar'
import { WorkplaceAssignmentFiltersBar } from '../components/config/WorkplaceAssignmentFiltersBar'
import { WorkplaceBulkActions } from '../components/config/WorkplaceBulkActions'
import { validateWorkplaceRegionChange } from '../domain/organization/assignmentValidation'
import {
  defaultWorkplaceFilters,
  filterWorkplaces,
} from '../domain/organization/workplaceAssignmentUi'
import {
  isOrganizationSynced,
  useOrganizationActions,
  useOrganizationSnapshot,
} from '../store/organizationStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigRegionalAssignmentsPage() {
  const snapshot = useOrganizationSnapshot()
  const { setWorkplaceRegion, bulkSetWorkplaceAssignments } = useOrganizationActions()
  const { notify } = useNotifications()
  const synced = isOrganizationSynced(snapshot)

  const [filters, setFilters] = useState(defaultWorkplaceFilters)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const orgUnitById = useMemo(
    () => new Map(snapshot.orgUnits.map((unit) => [unit.id, unit])),
    [snapshot.orgUnits],
  )

  const rows = useMemo(
    () => filterWorkplaces(snapshot, filters, { includeAbsent: filters.onlyAbsent }),
    [snapshot, filters],
  )

  function toggleSelected(workplaceId: string) {
    setSelectedIds((current) =>
      current.includes(workplaceId)
        ? current.filter((id) => id !== workplaceId)
        : [...current, workplaceId],
    )
  }

  function handleRegionChange(workplaceId: string, regionId: string) {
    const workplace = snapshot.workplaces.find((item) => item.id === workplaceId)
    const error = validateWorkplaceRegionChange(snapshot, workplaceId, regionId)
    if (error) {
      notify({ type: 'error', title: 'Neplatná změna', message: error.message })
      return
    }
    setWorkplaceRegion(workplaceId, regionId)
    const region = snapshot.regions.find((item) => item.id === regionId)
    notify({
      type: 'success',
      title: 'Region změněn',
      message: `Pracoviště ${workplace?.name ?? workplaceId} přesunuto do regionu ${region?.name ?? regionId}.`,
    })
  }

  function handleBulkRegion(regionId: string) {
    const region = snapshot.regions.find((item) => item.id === regionId)
    bulkSetWorkplaceAssignments(selectedIds, { regionId })
    notify({
      type: 'success',
      title: 'Hromadná změna',
      message: `${selectedIds.length} pracovišť přiřazeno do regionu ${region?.name ?? regionId}.`,
    })
    setSelectedIds([])
  }

  if (!synced) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Pracoviště → Regiony</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nejprve synchronizujte organizaci z Excelu. Přiřazení regionů je dostupné až po sync.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pracoviště → Regiony</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ruční změny se ukládají do organizačního snapshotu a okamžitě promítnou do mapy a exportu.
          </p>
        </div>
        <AssignmentToolbar />
      </div>

      <WorkplaceAssignmentFiltersBar
        filters={filters}
        onChange={setFilters}
        snapshot={snapshot}
      />

      <WorkplaceBulkActions
        selectedIds={selectedIds}
        snapshot={snapshot}
        mode="region"
        onApplyRegion={handleBulkRegion}
        onApplyLeader={() => undefined}
        onClearSelection={() => setSelectedIds([])}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3" />
              <th className="px-4 py-3">Pracoviště</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Vedoucí</th>
              <th className="px-4 py-3">Org. složka</th>
              <th className="px-4 py-3 text-right">Okresů</th>
              <th className="px-4 py-3">Změna regionu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ workplace, districtCount }) => {
              const leader = snapshot.leaders.find((item) => item.id === workplace.leaderId)
              const region = snapshot.regions.find((item) => item.id === workplace.regionId)
              const orgUnit = orgUnitById.get(workplace.orgUnitId)
              const disabled = Boolean(workplace.absentFromSync)

              return (
                <tr
                  key={workplace.id}
                  className={disabled ? 'bg-slate-50 text-slate-500' : undefined}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={selectedIds.includes(workplace.id)}
                      onChange={() => toggleSelected(workplace.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {workplace.name}
                    {workplace.manualEdits?.regionId && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        ruční
                      </span>
                    )}
                    {disabled && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">
                        absentFromSync
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{region?.name ?? '—'}</td>
                  <td className="px-4 py-3">{leader?.name ?? '—'}</td>
                  <td className="px-4 py-3">{orgUnit?.designation ?? workplace.orgUnitId}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{districtCount}</td>
                  <td className="px-4 py-3">
                    <select
                      disabled={disabled}
                      className="w-full min-w-[10rem] rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
                      value={workplace.regionId}
                      onChange={(event) => handleRegionChange(workplace.id, event.target.value)}
                    >
                      <option value="">—</option>
                      {snapshot.regions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
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
