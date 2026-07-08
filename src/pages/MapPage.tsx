import { CzechMap } from '../components/map/CzechMap'
import { MapControls } from '../components/map/MapControls'
import { MapHoverPanel } from '../components/map/MapHoverPanel'
import { MapLegend } from '../components/map/MapLegend'
import { useActiveVisualization } from '../hooks/useVisualization'

export function MapPage() {
  const { colors, legend } = useActiveVisualization()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Mapa ČR</h2>
        <p className="mt-1 text-sm text-slate-600">
          Mapa je vždy dostupná. Datové vizualizace vyžadují připravený dataset.
        </p>
      </div>

      <MapControls />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <CzechMap colors={colors} />
        <div className="space-y-4">
          <MapLegend legend={legend} />
          <MapHoverPanel />
        </div>
      </div>
    </div>
  )
}
