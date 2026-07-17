import { ColorInput } from '../config/ColorInput'
import type { SupervisionPlanYearConfig } from '../../domain/supervision-plan/types'

interface SupervisionPlanYearSettingsProps {
  years: SupervisionPlanYearConfig[]
  assignmentCountByYear: Record<number, number>
  onColorChange: (year: number, color: string) => void
  onToggleActive: (year: number, isActive: boolean) => void
  onRemoveYear: (year: number) => void
  onMoveYear: (year: number, direction: 'up' | 'down') => void
}

export function SupervisionPlanYearSettings({
  years,
  assignmentCountByYear,
  onColorChange,
  onToggleActive,
  onRemoveYear,
  onMoveYear,
}: SupervisionPlanYearSettingsProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Barvy a roky</h3>
      <ul className="space-y-2">
        {years.map((yearConfig, index) => (
          <li
            key={yearConfig.year}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
          >
            <span className="min-w-[3rem] font-medium text-slate-800">{yearConfig.year}</span>
            <ColorInput value={yearConfig.color} onChange={(color) => onColorChange(yearConfig.year, color)} />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={yearConfig.isActive}
                onChange={(event) => onToggleActive(yearConfig.year, event.target.checked)}
              />
              Aktivní
            </label>
            <span className="text-xs text-slate-500">
              {assignmentCountByYear[yearConfig.year] ?? 0} pracovišť
            </span>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={index === 0}
                onClick={() => onMoveYear(yearConfig.year, 'up')}
              >
                ↑
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-0.5 text-xs disabled:opacity-40"
                disabled={index === years.length - 1}
                onClick={() => onMoveYear(yearConfig.year, 'down')}
              >
                ↓
              </button>
              <button
                type="button"
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700"
                onClick={() => onRemoveYear(yearConfig.year)}
              >
                Odebrat
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
