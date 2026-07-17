import type { SupervisionPlanSummary } from '../../domain/supervision-plan/supervisionPlanSummary'

interface SupervisionPlanSummaryProps {
  summary: SupervisionPlanSummary
}

export function SupervisionPlanSummaryPanel({ summary }: SupervisionPlanSummaryProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-slate-500">Celkem pracovišť</p>
        <p className="text-2xl font-semibold text-slate-900">{summary.totalWorkplaces}</p>
      </div>
      <div>
        <p className="text-slate-500">Naplánováno</p>
        <p className="text-2xl font-semibold text-slate-900">{summary.plannedCount}</p>
      </div>
      <div>
        <p className="text-slate-500">Bez plánu</p>
        <p className="text-2xl font-semibold text-slate-900">{summary.unplannedCount}</p>
      </div>
      <div className="space-y-1">
        <p className="text-slate-500">Rozložení podle roků</p>
        <ul className="space-y-0.5">
          {summary.byYear.map((item) => (
            <li key={item.year} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-slate-200"
                style={{ backgroundColor: item.color }}
              />
              <span>
                {item.year}: {item.count}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2 text-slate-600">
            <span className="inline-block h-3 w-3 rounded-sm border border-slate-200 bg-slate-200" />
            Bez plánu: {summary.unplanned.count}
          </li>
        </ul>
      </div>
    </div>
  )
}
