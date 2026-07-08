import type { LegendSpec } from '../../domain/visualization/types'

interface MapLegendProps {
  legend: LegendSpec
}

export function MapLegend({ legend }: MapLegendProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{legend.title}</h3>

      {legend.scale ? (
        <div className="space-y-2">
          <div
            className="h-3 w-full rounded"
            style={{
              background: `linear-gradient(to right, ${legend.scale.colors.join(', ')})`,
            }}
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>{legend.scale.min}</span>
            <span>{legend.scale.max}</span>
          </div>
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto">
          {legend.items.length === 0 ? (
            <p className="text-sm text-slate-500">Legenda není k dispozici.</p>
          ) : (
            legend.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-sm border border-slate-200"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-700">{item.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
