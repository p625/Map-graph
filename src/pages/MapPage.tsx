import { useMemo, useState } from 'react'
import { CzechMap } from '../components/map/CzechMap'
import { MapBoundaryControls } from '../components/map/MapBoundaryControls'
import { MapControls } from '../components/map/MapControls'
import { MapExportPanel } from '../components/map/export/MapExportPanel'
import { MapHoverPanel } from '../components/map/MapHoverPanel'
import { MapLegend } from '../components/map/MapLegend'
import { RegionFocusControls } from '../components/map/RegionFocusControls'
import { getInteractiveDistrictIds } from '../domain/region/regionFocus'
import { isRegionFocused } from '../domain/region/regionScope'
import { useActiveVisualization } from '../hooks/useVisualization'
import { useMapRenderModel } from '../hooks/useMapRenderModel'
import { useRegionScope, useValidateFocusedRegion } from '../hooks/useRegionScope'
import { useMapActions, useMapState } from '../store/mapStore'
import { cn } from '../utils/cn'

type MapViewMode = 'interactive' | 'export'

export function MapPage() {
  const { colors, legend, context, plugin } = useActiveVisualization()
  const regionScope = useRegionScope()
  useValidateFocusedRegion()
  const {
    boundaryVisibility,
    showLabels,
    labelScope,
    labelContentMode,
    hoveredPolygon,
    selectedPolygon,
  } = useMapState()
  const { setHoveredPolygon, clearHoveredPolygon, setSelectedPolygon } = useMapActions()
  const [viewMode, setViewMode] = useState<MapViewMode>('interactive')

  const mapWidth = 760
  const mapHeight = 460
  const districtInteraction = plugin.districtInteraction ?? false

  const { resolver, territories, fillStyles, boundaryLayers, labels, viewport } = useMapRenderModel({
    width: mapWidth,
    height: mapHeight,
    colors,
    strokeColor: context.theme.strokeColor,
    boundaryVisibility,
    showLabels,
    labelScope,
    labelContentMode,
    context,
    separateDistrictStrokes: districtInteraction,
    regionScope,
    regionRenderMode: 'interactive',
  })

  const interactiveDistrictIds = useMemo(
    () => getInteractiveDistrictIds(regionScope),
    [regionScope],
  )

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
    if (isRegionFocused(regionScope) && regionScope.regionName) {
      parts.push(regionScope.regionName)
    }
    return parts.join(' · ')
  }, [plugin.name, context.theme, regionScope])

  function resolvePolygonFromDistrict(districtId: string | null) {
    if (!districtId) return null
    if (interactiveDistrictIds && !interactiveDistrictIds.has(districtId)) {
      return null
    }
    const workplaceId = resolver.getWorkplaceIdForDistrict(districtId)
    if (districtInteraction) {
      return { workplaceId, districtIds: [districtId] }
    }
    const districtIds = workplaceId
      ? resolver.getDistrictIdsForWorkplace(workplaceId)
      : [districtId]
    return { workplaceId, districtIds }
  }

  function handleHoverDistrict(districtId: string | null) {
    if (!districtId) {
      clearHoveredPolygon()
      return
    }
    const polygon = resolvePolygonFromDistrict(districtId)
    if (polygon) setHoveredPolygon(polygon)
  }

  function handleSelectDistrict(districtId: string | null) {
    if (!districtId) {
      setSelectedPolygon(null)
      return
    }
    const polygon = resolvePolygonFromDistrict(districtId)
    if (!polygon) return
    const isSame = districtInteraction
      ? selectedPolygon?.districtIds[0] === districtId
      : selectedPolygon?.workplaceId === polygon.workplaceId &&
        selectedPolygon.districtIds.length === polygon.districtIds.length
    setSelectedPolygon(isSame ? null : polygon)
  }

  const highlightedDistrictIds = hoveredPolygon?.districtIds ?? []
  const selectedDistrictIds = selectedPolygon?.districtIds ?? []

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
      <RegionFocusControls />

      {viewMode === 'interactive' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <CzechMap
            territories={territories}
            fillStyles={fillStyles}
            boundaryLayers={boundaryLayers}
            labels={labels}
            resolver={resolver}
            width={mapWidth}
            height={mapHeight}
            viewport={viewport?.viewBox ?? null}
            interactiveDistrictIds={interactiveDistrictIds}
            highlightedDistrictIds={highlightedDistrictIds}
            selectedDistrictIds={selectedDistrictIds}
            onHoverDistrict={handleHoverDistrict}
            onSelectDistrict={handleSelectDistrict}
          />
          <div className="space-y-4">
            <MapBoundaryControls hasDataColumn={Boolean(context.column)} />
            <MapLegend legend={legend} />
            <MapHoverPanel resolver={resolver} districtInteraction={districtInteraction} />
          </div>
        </div>
      ) : (
        <MapExportPanel
          colors={colors}
          legend={legend}
          context={context}
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
