import { useMemo, useState } from 'react'
import { CzechMap } from '../components/map/CzechMap'
import { MapControls } from '../components/map/MapControls'
import { MapExportPanel } from '../components/map/export/MapExportPanel'
import { MapHoverPanel } from '../components/map/MapHoverPanel'
import { MapLegend } from '../components/map/MapLegend'
import { useActiveVisualization } from '../hooks/useVisualization'
import { cn } from '../utils/cn'

type MapViewMode = 'interactive' | 'export'

export function MapPage() {
  const { colors, legend, context, plugin } = useActiveVisualization()
  const [viewMode, setViewMode] = useState<MapViewMode>('interactive')

  const defaultTitle = useMemo(() => {
    if (context.dataset && context.column) {
      return `${context.dataset.name} — ${context.column.name}`
    }
    if (context.dataset) return context.dataset.name
    return plugin.name
  }, [context.dataset, context.column, plugin.name])

  const defaultSubtitle = useMemo(() => {
    const parts: string[] = [plugin.name]
    if (context.theme) parts.push(context.theme.name)
    return parts.join(' · ')
  }, [plugin.name, context.theme])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Mapa ČR</h2>
          <p className="mt-1 text-sm text-slate-600">
            {viewMode === 'interactive'
              ? 'Mapa je vždy dostupná. Datové vizualizace vyžadují připravený dataset.'
              : 'Připravte mapový graf a exportujte ho jako PNG pro PowerPoint nebo Word.'}
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              viewMode === 'interactive' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
            onClick={() => setViewMode('interactive')}
          >
            Zobrazení mapy
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors',
              viewMode === 'export' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
            onClick={() => setViewMode('export')}
          >
            Příprava výstupu
          </button>
        </div>
      </div>

      <MapControls />

      {viewMode === 'interactive' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <CzechMap colors={colors} />
          <div className="space-y-4">
            <MapLegend legend={legend} />
            <MapHoverPanel />
          </div>
        </div>
      ) : (
        <MapExportPanel
          colors={colors}
          legend={legend}
          dataset={context.dataset}
          column={context.column}
          pluginName={plugin.name}
          themeName={context.theme.name}
          strokeColor={context.theme.strokeColor}
          defaultTitle={defaultTitle}
          defaultSubtitle={defaultSubtitle}
        />
      )}
    </div>
  )
}
