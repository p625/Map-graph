import type { WorkplaceAssignmentFilters } from '../../domain/organization/workplaceAssignmentUi'
import type { OrganizationSnapshot } from '../../domain/organization/types'

interface WorkplaceAssignmentFiltersProps {
  filters: WorkplaceAssignmentFilters
  onChange: (filters: WorkplaceAssignmentFilters) => void
  snapshot: OrganizationSnapshot
  showConflictFilter?: boolean
}

export function WorkplaceAssignmentFiltersBar({
  filters,
  onChange,
  snapshot,
  showConflictFilter = true,
}: WorkplaceAssignmentFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
        Hledat pracoviště
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Název OPŽL…"
        />
      </label>

      <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
        Region
        <select
          value={filters.regionId}
          onChange={(event) => onChange({ ...filters, regionId: event.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Všechny</option>
          {snapshot.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600">
        Vedoucí
        <select
          value={filters.leaderId}
          onChange={(event) => onChange({ ...filters, leaderId: event.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Všichni</option>
          {snapshot.leaders.map((leader) => (
            <option key={leader.id} value={leader.id}>
              {leader.name}
            </option>
          ))}
        </select>
      </label>

      {showConflictFilter && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.onlyConflicts}
            onChange={(event) => onChange({ ...filters, onlyConflicts: event.target.checked })}
          />
          Pouze ruční změny
        </label>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.onlyAbsent}
          onChange={(event) => onChange({ ...filters, onlyAbsent: event.target.checked })}
        />
        Pouze absentFromSync
      </label>
    </div>
  )
}
