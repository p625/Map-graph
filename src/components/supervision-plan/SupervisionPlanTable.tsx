import type { SupervisionPlanTableRow } from '../../domain/supervision-plan/supervisionPlanTable'
import type { SupervisionPlanYearConfig } from '../../domain/supervision-plan/types'
import type { SupervisionPlanSortKey } from '../../domain/supervision-plan/supervisionPlanTable'

interface SupervisionPlanTableProps {
  rows: SupervisionPlanTableRow[]
  years: SupervisionPlanYearConfig[]
  selectedIds: string[]
  sortKey: SupervisionPlanSortKey
  sortDirection: 'asc' | 'desc'
  onToggleSelect: (workplaceId: string) => void
  onToggleSelectAll: (checked: boolean) => void
  onAssignYear: (workplaceId: string, year: number | null) => void
  onNoteChange: (workplaceId: string, note: string) => void
  onSort: (key: SupervisionPlanSortKey) => void
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string
  sortKey: SupervisionPlanSortKey
  activeKey: SupervisionPlanSortKey
  direction: 'asc' | 'desc'
  onSort: (key: SupervisionPlanSortKey) => void
}) {
  const active = activeKey === sortKey
  return (
    <button type="button" className="font-semibold hover:text-blue-700" onClick={() => onSort(sortKey)}>
      {label}
      {active ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  )
}

export function SupervisionPlanTable({
  rows,
  years,
  selectedIds,
  sortKey,
  sortDirection,
  onToggleSelect,
  onToggleSelectAll,
  onAssignYear,
  onNoteChange,
  onSort,
}: SupervisionPlanTableProps) {
  const activeYears = years.filter((y) => y.isActive)
  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="sticky left-0 z-30 bg-slate-50 px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                aria-label="Vybrat vše"
              />
            </th>
            <th className="sticky left-10 z-30 min-w-[180px] bg-slate-50 px-3 py-2">
              <SortButton label="Pracoviště" sortKey="workplace" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
            </th>
            <th className="sticky left-[220px] z-30 min-w-[140px] bg-slate-50 px-3 py-2">
              <SortButton label="Vedoucí" sortKey="leader" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
            </th>
            <th className="min-w-[160px] px-3 py-2">Org. jednotka</th>
            <th className="min-w-[120px] px-3 py-2">
              <SortButton label="Region" sortKey="region" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
            </th>
            {activeYears.map((year) => (
              <th key={year.year} className="min-w-[72px] px-2 py-2 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200"
                    style={{ backgroundColor: year.color }}
                  />
                  {year.year}
                </div>
              </th>
            ))}
            <th className="min-w-[80px] px-2 py-2 text-center">Bez plánu</th>
            <th className="min-w-[160px] px-3 py-2">Poznámka</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.workplaceId} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="sticky left-0 z-10 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.workplaceId)}
                  onChange={() => onToggleSelect(row.workplaceId)}
                />
              </td>
              <td className="sticky left-10 z-10 bg-white px-3 py-2 font-medium text-slate-900">
                {row.workplaceName}
              </td>
              <td className="sticky left-[220px] z-10 bg-white px-3 py-2 text-slate-700">{row.leaderName}</td>
              <td className="px-3 py-2 text-slate-700">{row.orgUnitLabel}</td>
              <td className="px-3 py-2 text-slate-700">{row.regionName}</td>
              {activeYears.map((year) => (
                <td key={year.year} className="px-2 py-2 text-center">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 hover:border-blue-400"
                    style={{
                      backgroundColor: row.plannedYear === year.year ? year.color : 'transparent',
                    }}
                    aria-label={`Přiřadit ${row.workplaceName} k roku ${year.year}`}
                    aria-pressed={row.plannedYear === year.year}
                    onClick={() =>
                      onAssignYear(row.workplaceId, row.plannedYear === year.year ? year.year : year.year)
                    }
                  >
                    {row.plannedYear === year.year ? '✓' : ''}
                  </button>
                </td>
              ))}
              <td className="px-2 py-2 text-center">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 hover:border-slate-400"
                  aria-pressed={row.plannedYear === null}
                  onClick={() => onAssignYear(row.workplaceId, null)}
                >
                  {row.plannedYear === null ? '●' : ''}
                </button>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  value={row.note}
                  placeholder="Poznámka"
                  onChange={(event) => onNoteChange(row.workplaceId, event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
