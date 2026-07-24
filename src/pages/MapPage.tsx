import { useMemo, useRef, useState } from 'react'
import { CzechMap } from '../components/map/CzechMap'
import { MapBoundaryControls } from '../components/map/MapBoundaryControls'
import { MapControls } from '../components/map/MapControls'
import { MapExportPanel } from '../components/map/export/MapExportPanel'
import { MapHoverPanel } from '../components/map/MapHoverPanel'
import { MapLabelEditDialog } from '../components/map/MapLabelEditDialog'
import { MapLegend } from '../components/map/MapLegend'
import { RegionFocusControls } from '../components/map/RegionFocusControls'
import { getInteractiveDistrictIds } from '../domain/region/regionFocus'
import { isRegionFocused } from '../domain/region/regionScope'
import {
  MAP_LOGICAL_HEIGHT,
  MAP_LOGICAL_WIDTH,
} from '../domain/map/mapViewport'
import { MAP_EDITOR_VIEWPORT_HEIGHT_CSS } from '../domain/map/mapEditorLayout'
import { mergeRegionLabelOverrideMaps } from '../domain/labels/regionLabelOverrides'
import { mergeWorkplaceLabelOverrideMaps } from '../domain/labels/workplaceLabelOverrides'
import type { RegionLabelOverrideMap } from '../domain/labels/regionLabelOverrides'
import type { WorkplaceLabelOverrideMap } from '../domain/labels/workplaceLabelOverrides'
import { useActiveVisualization } from '../hooks/useVisualization'
import { useMapRenderModel } from '../hooks/useMapRenderModel'
import { useOrganizationLegendItems } from '../hooks/useOrganizationLegend'
import { useRegionScope, useValidateFocusedRegion } from '../hooks/useRegionScope'
import { useMapActions, useMapState } from '../store/mapStore'
import { useSupervisionPlan } from '../store/supervisionPlanStore'
import { useRegionLabelOverrides } from '../store/regionLabelOverridesStore'
import { useWorkplaceLabelOverrides } from '../store/workplaceLabelOverridesStore'
import { CustomGradientEditor } from '../features/map-editor/color-theme/CustomGradientEditor'
import { useCustomColorThemes } from '../store/customColorThemesStore'
import { cn } from '../utils/cn'

type MapViewMode = 'interactive' | 'export'

type LabelEditTarget = {
  kind: 'workplace' | 'region'
  entityId: string
  entityName: string
  currentText: string
}

export function MapPage() {
  const { colors, legend, context, plugin } = useActiveVisualization()
  const regionScope = useRegionScope()
  useValidateFocusedRegion()
  const {
    boundaryVisibility,
    showLabels,
    labelVisibility,
    labelFontSizes,
    labelContentMode,
    hoveredPolygon,
    selectedPolygon,
    organizationLegend,
    labelEditMode,
    regionLabelEditMode,
    editorView,
    hoveredPolygon: currentHover,
    supervisionYearFilter,
  } = useMapState()
  const {
    setHoveredPolygon,
    clearHoveredPolygon,
    setSelectedPolygon,
    setEditorView,
    resetEditorView,
  } = useMapActions()
  const { overrides: workplaceOverrides, setOverride: setWorkplaceOverride, resetText: resetWorkplaceText } =
    useWorkplaceLabelOverrides()
  const { overrides: regionOverrides, setOverride: setRegionOverride, resetText: resetRegionText } =
    useRegionLabelOverrides()
  const [draftWorkplaceOverrides, setDraftWorkplaceOverrides] = useState<WorkplaceLabelOverrideMap>({})
  const [draftRegionOverrides, setDraftRegionOverrides] = useState<RegionLabelOverrideMap>({})
  const labelDragBaseRef = useRef<
    Record<string, { kind: 'workplace' | 'region'; offsetX: number; offsetY: number }>
  >({})
  const [labelEditTarget, setLabelEditTarget] = useState<LabelEditTarget | null>(null)
  const [viewMode, setViewMode] = useState<MapViewMode>('interactive')

  const organizationLegendItems = useOrganizationLegendItems(organizationLegend)
  const supervisionPlan = useSupervisionPlan()
  const { isGradientEditorOpen } = useCustomColorThemes()
  const showGradientEditor = plugin.id === 'choropleth' && isGradientEditorOpen

  const mapWidth = MAP_LOGICAL_WIDTH
  const mapHeight = MAP_LOGICAL_HEIGHT
  const districtInteraction = plugin.districtInteraction ?? false

  const mergedWorkplaceOverrides = useMemo(
    () => mergeWorkplaceLabelOverrideMaps(workplaceOverrides, draftWorkplaceOverrides),
    [workplaceOverrides, draftWorkplaceOverrides],
  )
  const mergedRegionOverrides = useMemo(
    () => mergeRegionLabelOverrideMaps(regionOverrides, draftRegionOverrides),
    [regionOverrides, draftRegionOverrides],
  )

  const { resolver, territories, fillStyles, boundaryLayers, labels, viewport } = useMapRenderModel({
    width: mapWidth,
    height: mapHeight,
    colors,
    strokeColor: context.theme.strokeColor,
    boundaryVisibility,
    showLabels,
    labelVisibility,
    labelFontSizes,
    labelContentMode,
    context,
    separateDistrictStrokes: districtInteraction,
    regionScope,
    regionRenderMode: 'interactive',
    workplaceLabelOverrides: mergedWorkplaceOverrides,
    regionLabelOverrides: mergedRegionOverrides,
  })

  const interactiveDistrictIds = useMemo(
    () => getInteractiveDistrictIds(regionScope),
    [regionScope],
  )

  const defaultTitle = useMemo(() => {
    if (plugin.id === 'supervision-plan') {
      if (typeof supervisionYearFilter === 'number') {
        return `${supervisionPlan.name} — rok ${supervisionYearFilter}`
      }
      return supervisionPlan.name
    }
    if (context.dataset && context.column) {
      return `${context.dataset.name} — ${context.column.name}`
    }
    if (context.dataset) return context.dataset.name
    return plugin.name
  }, [context.dataset, context.column, plugin.id, plugin.name, supervisionPlan.name, supervisionYearFilter])

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
    if (!polygon) return
    const same =
      currentHover &&
      currentHover.workplaceId === polygon.workplaceId &&
      currentHover.districtIds.join(',') === polygon.districtIds.join(',')
    if (same) return
    setHoveredPolygon(polygon)
  }

  function ensureDragBase(kind: 'workplace' | 'region', entityId: string) {
    const key = `${kind}:${entityId}`
    if (!labelDragBaseRef.current[key]) {
      const source = kind === 'workplace' ? workplaceOverrides : regionOverrides
      labelDragBaseRef.current[key] = {
        kind,
        offsetX: source[entityId]?.offsetX ?? 0,
        offsetY: source[entityId]?.offsetY ?? 0,
      }
    }
    return labelDragBaseRef.current[key]
  }

  function handleWorkplaceLabelDrag(workplaceId: string, dx: number, dy: number) {
    const base = ensureDragBase('workplace', workplaceId)
    base.offsetX += dx
    base.offsetY += dy
    setDraftWorkplaceOverrides((current) =>
      mergeWorkplaceLabelOverrideMaps(current, {
        [workplaceId]: {
          workplaceId,
          offsetX: base.offsetX,
          offsetY: base.offsetY,
          manualPosition: true,
        },
      }),
    )
  }

  function handleWorkplaceLabelDragEnd(workplaceId: string) {
    const key = `workplace:${workplaceId}`
    const base = labelDragBaseRef.current[key]
    if (!base) return
    setWorkplaceOverride(workplaceId, {
      offsetX: base.offsetX,
      offsetY: base.offsetY,
      manualPosition: true,
      updatedAt: new Date().toISOString(),
    })
    delete labelDragBaseRef.current[key]
    setDraftWorkplaceOverrides((current) => {
      const copy = { ...current }
      delete copy[workplaceId]
      return copy
    })
  }

  function handleRegionLabelDrag(regionId: string, dx: number, dy: number) {
    const base = ensureDragBase('region', regionId)
    base.offsetX += dx
    base.offsetY += dy
    setDraftRegionOverrides((current) =>
      mergeRegionLabelOverrideMaps(current, {
        [regionId]: {
          regionId,
          offsetX: base.offsetX,
          offsetY: base.offsetY,
          manualPosition: true,
        },
      }),
    )
  }

  function handleRegionLabelDragEnd(regionId: string) {
    const key = `region:${regionId}`
    const base = labelDragBaseRef.current[key]
    if (!base) return
    setRegionOverride(regionId, {
      offsetX: base.offsetX,
      offsetY: base.offsetY,
      manualPosition: true,
      updatedAt: new Date().toISOString(),
    })
    delete labelDragBaseRef.current[key]
    setDraftRegionOverrides((current) => {
      const copy = { ...current }
      delete copy[regionId]
      return copy
    })
  }

  function handleWorkplaceLabelTextEdit(workplaceId: string, currentText: string) {
    const workplace = resolver.getWorkplace(workplaceId)
    setLabelEditTarget({
      kind: 'workplace',
      entityId: workplaceId,
      entityName: workplace?.name ?? workplaceId,
      currentText,
    })
  }

  function handleRegionLabelTextEdit(regionId: string, currentText: string) {
    const region = resolver.regionalOffices.find((item) => item.id === regionId)
    setLabelEditTarget({
      kind: 'region',
      entityId: regionId,
      entityName: region?.name ?? regionId,
      currentText,
    })
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
        <div
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start"
          style={{ ['--map-editor-height' as string]: MAP_EDITOR_VIEWPORT_HEIGHT_CSS }}
        >
          <div className="min-w-0" style={{ height: 'var(--map-editor-height)' }}>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => resetEditorView()}
              >
                Obnovit pohled
              </button>
              <span className="text-slate-600">Zoom: {Math.round(editorView.zoom * 100)} %</span>
              <span className="text-xs text-slate-500">
                Kolečko = zoom · prostřední / pravé tlačítko / Space + levé = posun
              </span>
            </div>
            <div className="h-[calc(var(--map-editor-height)-2.5rem)] min-h-[640px]">
              <CzechMap
                className="h-full rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                territories={territories}
                fillStyles={fillStyles}
                boundaryLayers={boundaryLayers}
                labels={labels}
                organizationLegendItems={organizationLegendItems}
                organizationLegendSettings={organizationLegend}
                resolver={resolver}
                width={mapWidth}
                height={mapHeight}
                viewport={viewport?.viewBox ?? null}
              editorView={editorView}
              onEditorViewChange={setEditorView}
              interactiveDistrictIds={interactiveDistrictIds}
              highlightedDistrictIds={highlightedDistrictIds}
              selectedDistrictIds={selectedDistrictIds}
              labelEditMode={labelEditMode}
              regionLabelEditMode={regionLabelEditMode}
              onHoverDistrict={handleHoverDistrict}
              onSelectDistrict={handleSelectDistrict}
              onLabelDrag={handleWorkplaceLabelDrag}
              onLabelDragEnd={handleWorkplaceLabelDragEnd}
              onLabelTextEdit={handleWorkplaceLabelTextEdit}
              onRegionLabelDrag={handleRegionLabelDrag}
              onRegionLabelDragEnd={handleRegionLabelDragEnd}
              onRegionLabelTextEdit={handleRegionLabelTextEdit}
              />
            </div>
          </div>
          <div
            className="space-y-4 xl:max-h-[var(--map-editor-height)] xl:overflow-y-auto xl:overscroll-contain"
          >
            {showGradientEditor && <CustomGradientEditor context={context} />}
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

      {labelEditTarget && (
        <MapLabelEditDialog
          entityName={labelEditTarget.entityName}
          initialText={labelEditTarget.currentText}
          onSave={(text) => {
            if (labelEditTarget.kind === 'workplace') {
              setWorkplaceOverride(labelEditTarget.entityId, { displayText: text, manualPosition: true })
            } else {
              setRegionOverride(labelEditTarget.entityId, { displayText: text, manualPosition: true })
            }
            setLabelEditTarget(null)
          }}
          onCancel={() => setLabelEditTarget(null)}
          onReset={() => {
            if (labelEditTarget.kind === 'workplace') {
              resetWorkplaceText(labelEditTarget.entityId)
            } else {
              resetRegionText(labelEditTarget.entityId)
            }
            setLabelEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
