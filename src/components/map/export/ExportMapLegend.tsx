import type { LegendSpec } from '../../../domain/visualization/types'

interface ExportMapLegendProps {
  legend: LegendSpec
  compact?: boolean
}

export function ExportMapLegend({ legend, compact = false }: ExportMapLegendProps) {
  return (
    <div>
      <h3
        className="font-semibold text-slate-900"
        style={{ fontSize: compact ? 14 : 16, marginBottom: compact ? 8 : 12 }}
      >
        {legend.title}
      </h3>

      {legend.scale ? (
        <div className="space-y-2">
          <div
            style={{
              height: compact ? 10 : 14,
              width: '100%',
              borderRadius: 4,
              background: `linear-gradient(to right, ${legend.scale.colors.join(', ')})`,
            }}
          />
          <div
            className="flex justify-between text-slate-600"
            style={{ fontSize: compact ? 11 : 12 }}
          >
            <span>{legend.scale.min}</span>
            <span>{legend.scale.max}</span>
          </div>
        </div>
      ) : (
        <div
          className="space-y-1.5 overflow-hidden"
          style={{ maxHeight: compact ? 220 : 320 }}
        >
          {legend.items.length === 0 ? (
            <p className="text-slate-500" style={{ fontSize: 12 }}>
              Legenda není k dispozici.
            </p>
          ) : (
            legend.items.map((item) => (
              <div key={item.id} className="flex items-start gap-2" style={{ fontSize: compact ? 11 : 12 }}>
                <span
                  className="mt-0.5 inline-block shrink-0 rounded-sm border border-slate-200"
                  style={{ backgroundColor: item.color, width: compact ? 10 : 12, height: compact ? 10 : 12 }}
                />
                <div>
                  <span className="text-slate-700">{item.label}</span>
                  {item.subtitle && (
                    <div className="text-slate-500" style={{ fontSize: compact ? 10 : 11 }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
