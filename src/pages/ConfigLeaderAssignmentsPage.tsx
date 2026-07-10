import { useMemo, useState } from 'react'
import { ColorInput } from '../components/config/ColorInput'
import { AssignmentToolbar } from '../components/config/AssignmentToolbar'
import { WorkplaceAssignmentFiltersBar } from '../components/config/WorkplaceAssignmentFiltersBar'
import { WorkplaceBulkActions } from '../components/config/WorkplaceBulkActions'
import { resolveLeaderColor } from '../domain/organization/leaderColors'
import { validateWorkplaceLeaderChange } from '../domain/organization/assignmentValidation'
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

export function ConfigLeaderAssignmentsPage() {
  const snapshot = useOrganizationSnapshot()
  const { setLeaderColor, setWorkplaceLeader, bulkSetWorkplaceAssignments } =
    useOrganizationActions()
  const { notify } = useNotifications()
  const synced = isOrganizationSynced(snapshot)

  const [filters, setFilters] = useState(defaultWorkplaceFilters)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const orgUnitById = useMemo(
    () => new Map(snapshot.orgUnits.map((unit) => [unit.id, unit])),
    [snapshot.orgUnits],
  )

  const activeWorkplaces = useMemo(
    () => snapshot.workplaces.filter((wp) => !wp.absentFromSync),
    [snapshot.workplaces],
  )

  const workplaceCountByLeader = useMemo(() => {
    const counts = new Map<string, number>()
    for (const wp of activeWorkplaces) {
      if (!wp.leaderId) continue
      counts.set(wp.leaderId, (counts.get(wp.leaderId) ?? 0) + 1)
    }
    return counts
  }, [activeWorkplaces])

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

  function handleLeaderChange(workplaceId: string, leaderId: string) {
    const workplace = snapshot.workplaces.find((item) => item.id === workplaceId)
    const error = validateWorkplaceLeaderChange(snapshot, workplaceId, leaderId)
    if (error) {
      notify({ type: 'error', title: 'Neplatná změna', message: error.message })
      return
    }
    setWorkplaceLeader(workplaceId, leaderId)
    const leader = snapshot.leaders.find((item) => item.id === leaderId)
    notify({
      type: 'success',
      title: 'Vedoucí změněn',
      message: `Pracoviště ${workplace?.name ?? workplaceId} přiřazeno vedoucímu ${leader?.name ?? leaderId}.`,
    })
  }

  function handleBulkLeader(leaderId: string) {
    const leader = snapshot.leaders.find((item) => item.id === leaderId)
    bulkSetWorkplaceAssignments(selectedIds, { leaderId })
    notify({
      type: 'success',
      title: 'Hromadná změna',
      message: `${selectedIds.length} pracovišť přiřazeno vedoucímu ${leader?.name ?? leaderId}.`,
    })
    setSelectedIds([])
  }

  if (!synced) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Pracoviště → Vedoucí</h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nejprve synchronizujte organizaci z Excelu. Vedoucí a jejich barvy jsou dostupné až po
          sync.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pracoviště → Vedoucí</h2>
          <p className="mt-1 text-sm text-slate-600">
            Barva vedoucího určuje obarvení všech jeho pracovišť v režimu „Podle vedoucích“.
          </p>
        </div>
        <AssignmentToolbar />
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Vedoucí a barvy</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vedoucí</th>
                <th className="px-4 py-3">Org. složka</th>
                <th className="px-4 py-3">Barva</th>
                <th className="px-4 py-3 text-right">Pracovišť</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.leaders.map((leader, index) => {
                const orgUnit = orgUnitById.get(leader.orgUnitId)
                const color = resolveLeaderColor(leader, index)
                return (
                  <tr key={leader.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{leader.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {orgUnit?.designation ?? leader.orgUnitId}
                    </td>
                    <td className="px-4 py-3">
                      <ColorInput
                        value={color}
                        onChange={(nextColor) => {
                          setLeaderColor(leader.id, nextColor)
                          notify({
                            type: 'info',
                            title: 'Barva vedoucího',
                            message: `${leader.name}: ${nextColor}`,
                          })
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {workplaceCountByLeader.get(leader.id) ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Přiřazení pracovišť</h3>

        <WorkplaceAssignmentFiltersBar
          filters={filters}
          onChange={setFilters}
          snapshot={snapshot}
        />

        <WorkplaceBulkActions
          selectedIds={selectedIds}
          snapshot={snapshot}
          mode="leader"
          onApplyRegion={() => undefined}
          onApplyLeader={handleBulkLeader}
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
                <th className="px-4 py-3">Barva</th>
                <th className="px-4 py-3">Změna vedoucího</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ workplace, districtCount }) => {
                const leader = snapshot.leaders.find((item) => item.id === workplace.leaderId)
                const leaderIndex = leader
                  ? snapshot.leaders.findIndex((item) => item.id === leader.id)
                  : 0
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
                      {workplace.manualEdits?.leaderId && (
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
                      {leader && (
                        <span
                          className="inline-block h-6 w-6 rounded border border-slate-200"
                          style={{ backgroundColor: resolveLeaderColor(leader, leaderIndex) }}
                          title={leader.name}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={disabled}
                        className="w-full min-w-[10rem] rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
                        value={workplace.leaderId}
                        onChange={(event) => handleLeaderChange(workplace.id, event.target.value)}
                      >
                        <option value="">—</option>
                        {snapshot.leaders.map((item) => (
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
      </section>
    </div>
  )
}
