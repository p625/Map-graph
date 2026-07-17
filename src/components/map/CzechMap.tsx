import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import type { LayeredBoundaryStrokes } from '../../domain/color/colorEngine'
import type { MapLabel } from '../../domain/labels/labelEngine'
import {
  clientPointToSvg,
  composeEditorViewBox,
  EDITOR_ZOOM_STEP,
  parseViewBox,
  pixelDeltaToSvgDelta,
  visibleToEditorState,
  zoomViewBoxAtPoint,
  type MapEditorViewState,
} from '../../domain/map/mapEditorViewport'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import type { TerritoryFillMap, TerritoryLayers } from '../../domain/territory/types'
import type { WorkplaceResolver } from '../../domain/territory/workplaceResolver'
import { OrganizationLegendOverlay } from './OrganizationLegendOverlay'
import { OrganizationMapLegend } from './OrganizationMapLegend'
import { MapLabelNode } from './MapLabelNode'

export interface CzechMapProps {
  territories: TerritoryLayers
  fillStyles: TerritoryFillMap
  boundaryLayers: LayeredBoundaryStrokes
  labels?: MapLabel[]
  organizationLegendItems?: OrganizationLegendItem[]
  organizationLegendSettings?: OrganizationLegendSettings
  resolver: WorkplaceResolver
  interactive?: boolean
  width?: number
  height?: number
  displayHeight?: number
  className?: string
  highlightedDistrictIds?: string[]
  selectedDistrictIds?: string[]
  viewport?: string | null
  editorView?: MapEditorViewState
  onEditorViewChange?: (view: MapEditorViewState) => void
  interactiveDistrictIds?: Set<string> | null
  labelEditMode?: boolean
  regionLabelEditMode?: boolean
  onHoverDistrict?: (districtId: string | null) => void
  onSelectDistrict?: (districtId: string | null) => void
  onLabelDrag?: (workplaceId: string, offsetX: number, offsetY: number) => void
  onLabelDragEnd?: (workplaceId: string) => void
  onLabelTextEdit?: (workplaceId: string, currentText: string) => void
  onRegionLabelDrag?: (regionId: string, offsetX: number, offsetY: number) => void
  onRegionLabelDragEnd?: (regionId: string) => void
  onRegionLabelTextEdit?: (regionId: string, currentText: string) => void
}

function renderBoundaryGroup(
  paths: LayeredBoundaryStrokes['district'],
  key: string,
) {
  return (
    <g key={key} data-layer={key} fill="none" pointerEvents="none">
      {paths.map((boundary) => (
        <path
          key={boundary.id}
          d={boundary.svgPath}
          stroke={boundary.stroke}
          strokeWidth={boundary.strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

export const CzechMap = forwardRef<HTMLDivElement, CzechMapProps>(function CzechMap(
  {
    territories,
    fillStyles,
    boundaryLayers,
    labels = [],
    organizationLegendItems = [],
    organizationLegendSettings,
    resolver,
    interactive = true,
    width = 760,
    height = 460,
    displayHeight,
    className = 'rounded-xl border border-slate-200 bg-white p-2 shadow-sm',
    highlightedDistrictIds = [],
    selectedDistrictIds = [],
    viewport = null,
    editorView,
    onEditorViewChange,
    interactiveDistrictIds = null,
    labelEditMode = false,
    regionLabelEditMode = false,
    onHoverDistrict,
    onSelectDistrict,
    onLabelDrag,
    onLabelDragEnd,
    onLabelTextEdit,
    onRegionLabelDrag,
    onRegionLabelDragEnd,
    onRegionLabelTextEdit,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const highlightSet = useMemo(() => new Set(highlightedDistrictIds), [highlightedDistrictIds])
  const selectedSet = useMemo(() => new Set(selectedDistrictIds), [selectedDistrictIds])
  const hasHighlight = highlightedDistrictIds.length > 0
  const lastHoverRef = useRef<string | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const labelEditActive = labelEditMode || regionLabelEditMode

  const dragRef = useRef<{
    entityId: string
    startX: number
    startY: number
  } | null>(null)

  const panRef = useRef<{
    startX: number
    startY: number
    startEditor: MapEditorViewState
  } | null>(null)

  const svgDisplayHeight = displayHeight ?? height
  const baseViewBox = viewport ?? `0 0 ${width} ${height}`
  const displayViewBox = useMemo(() => {
    if (!interactive || !editorView) return baseViewBox
    return composeEditorViewBox(baseViewBox, editorView, width, height)
  }, [interactive, editorView, baseViewBox, width, height])

  useEffect(() => {
    if (!interactive) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setSpacePressed(true)
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [interactive])

  function isDistrictInteractive(districtId: string): boolean {
    if (!interactive || isPanning) return false
    if (!interactiveDistrictIds) return true
    return interactiveDistrictIds.has(districtId)
  }

  function canPanWithButton(button: number): boolean {
    if (!interactive || !onEditorViewChange || !editorView) return false
    if (button === 1 || button === 2) return true
    if (button === 0 && spacePressed) return true
    if (button === 0 && !labelEditActive) return true
    return false
  }

  function getVisibleBox() {
    return parseViewBox(displayViewBox, width, height)
  }

  function getSvgRect(): DOMRect | null {
    return svgRef.current?.getBoundingClientRect() ?? null
  }

  function handlePointerEnter(districtId: string) {
    if (!isDistrictInteractive(districtId)) return
    if (lastHoverRef.current === districtId) return
    lastHoverRef.current = districtId
    onHoverDistrict?.(districtId)
  }

  function handleSvgPointerLeave() {
    if (!interactive) return
    lastHoverRef.current = null
    onHoverDistrict?.(null)
  }

  function handleClick(districtId: string) {
    if (!isDistrictInteractive(districtId)) return
    onSelectDistrict?.(districtId)
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (!interactive || !onEditorViewChange || !editorView) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const visible = getVisibleBox()
    const svgPoint = clientPointToSvg(event.clientX, event.clientY, rect, visible)
    const factor = event.deltaY < 0 ? EDITOR_ZOOM_STEP : 1 / EDITOR_ZOOM_STEP
    const nextVisible = zoomViewBoxAtPoint(visible, svgPoint.x, svgPoint.y, factor)
    const base = parseViewBox(baseViewBox, width, height)
    onEditorViewChange(visibleToEditorState(base, nextVisible))
  }

  function handleSvgPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!canPanWithButton(event.button)) return
    if (!editorView || !onEditorViewChange) return
    event.preventDefault()
    setIsPanning(true)
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startEditor: editorView,
    }
    event.currentTarget.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      if (!panRef.current || !onEditorViewChange) return
      const rect = getSvgRect()
      if (!rect) return
      const visible = getVisibleBox()
      const { dx, dy } = pixelDeltaToSvgDelta(
        moveEvent.clientX - panRef.current.startX,
        moveEvent.clientY - panRef.current.startY,
        rect,
        visible,
      )
      onEditorViewChange({
        ...panRef.current.startEditor,
        panX: panRef.current.startEditor.panX - dx,
        panY: panRef.current.startEditor.panY - dy,
      })
    }

    const onUp = () => {
      panRef.current = null
      setIsPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startLabelDrag(
    event: React.PointerEvent<SVGGElement>,
    entityId: string,
    onDrag: ((id: string, dx: number, dy: number) => void) | undefined,
    onDragEnd: ((id: string) => void) | undefined,
  ) {
    if (!onDrag) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      entityId,
      startX: event.clientX,
      startY: event.clientY,
    }

    const onMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return
      const rect = getSvgRect()
      if (!rect) return
      const visible = getVisibleBox()
      const { dx, dy } = pixelDeltaToSvgDelta(
        moveEvent.clientX - dragRef.current.startX,
        moveEvent.clientY - dragRef.current.startY,
        rect,
        visible,
      )
      dragRef.current.startX = moveEvent.clientX
      dragRef.current.startY = moveEvent.clientY
      onDrag(dragRef.current.entityId, dx, dy)
    }

    const onUp = () => {
      const entity = dragRef.current?.entityId
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (entity) onDragEnd?.(entity)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const panCursor =
    interactive && onEditorViewChange
      ? spacePressed
        ? 'grab'
        : labelEditActive
          ? undefined
          : 'grab'
      : undefined

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', minHeight: svgDisplayHeight, overflow: 'hidden' }}
    >
      <svg
        ref={svgRef}
        viewBox={displayViewBox}
        width="100%"
        height={svgDisplayHeight}
        style={{ display: 'block', cursor: isPanning ? 'grabbing' : panCursor }}
        role="img"
        aria-label="Mapa České republiky"
        onPointerLeave={handleSvgPointerLeave}
        onWheel={handleWheel}
        onPointerDown={handleSvgPointerDown}
        onContextMenu={(event) => {
          if (interactive && onEditorViewChange) event.preventDefault()
        }}
      >
        <g data-layer="district-fills">
          {territories.fillPolygons.map((polygon) => {
            const style = fillStyles[polygon.id]
            const isHighlighted = highlightSet.has(polygon.entityId)
            const isSelected = selectedSet.has(polygon.entityId)
            const dimmed = hasHighlight && !isHighlighted
            const districtInteractive = isDistrictInteractive(polygon.entityId)

            return (
              <path
                key={polygon.id}
                d={polygon.svgPath}
                fill={style?.fill ?? '#f8fafc'}
                stroke={
                  isSelected
                    ? '#0f172a'
                    : (style?.stroke ?? style?.fill ?? '#f8fafc')
                }
                strokeWidth={isSelected ? 1.2 : (style?.strokeWidth ?? 0.2)}
                vectorEffect="non-scaling-stroke"
                fillOpacity={style?.opacity ?? 1}
                data-district-id={polygon.entityId}
                data-workplace-id={resolver.getWorkplaceIdForDistrict(polygon.entityId) ?? ''}
                style={{
                  outline: 'none',
                  opacity: interactive && dimmed ? 0.55 : 1,
                  cursor: districtInteractive ? 'pointer' : interactive ? 'inherit' : 'default',
                  pointerEvents: districtInteractive || !interactive ? 'auto' : 'none',
                }}
                onPointerEnter={() => handlePointerEnter(polygon.entityId)}
                onClick={() => handleClick(polygon.entityId)}
              />
            )
          })}
        </g>

        {renderBoundaryGroup(boundaryLayers.district, 'district-boundaries')}
        {renderBoundaryGroup(boundaryLayers.workplace, 'workplace-boundaries')}
        {renderBoundaryGroup(boundaryLayers.region, 'region-boundaries')}

        {labels.length > 0 && (
          <g data-layer="labels" pointerEvents={labelEditActive ? 'auto' : 'none'}>
            {labels.filter((label) => label.visible).map((label) => {
              const isWorkplace = label.level === 'workplace'
              const isRegion = label.level === 'region'
              const workplaceId = isWorkplace ? label.id.replace(/^label-workplace-/, '') : null
              const regionId = isRegion ? label.id.replace(/^label-region-/, '') : null
              const canEditWorkplace = labelEditMode && isWorkplace && workplaceId
              const canEditRegion = regionLabelEditMode && isRegion && regionId

              if (canEditWorkplace && workplaceId) {
                return (
                  <MapLabelNode
                    key={label.id}
                    label={label}
                    canEdit
                    onDrag={onLabelDrag}
                    onDragEnd={onLabelDragEnd}
                    onTextEdit={(id, text) => onLabelTextEdit?.(id, text)}
                    onPointerDownDrag={startLabelDrag}
                  />
                )
              }

              if (canEditRegion && regionId) {
                return (
                  <MapLabelNode
                    key={label.id}
                    label={label}
                    canEdit
                    onDrag={onRegionLabelDrag}
                    onDragEnd={onRegionLabelDragEnd}
                    onTextEdit={(id, text) => onRegionLabelTextEdit?.(id, text)}
                    onPointerDownDrag={startLabelDrag}
                  />
                )
              }

              return <MapLabelNode key={label.id} label={label} canEdit={false} onPointerDownDrag={() => {}} />
            })}
          </g>
        )}

        {organizationLegendSettings && !interactive && (
          <OrganizationMapLegend
            items={organizationLegendItems}
            settings={organizationLegendSettings}
            mapWidth={width}
            mapHeight={height}
          />
        )}
      </svg>

      {interactive && organizationLegendSettings && (
        <OrganizationLegendOverlay
          items={organizationLegendItems}
          settings={organizationLegendSettings}
          containerWidth={width}
          containerHeight={height}
        />
      )}
    </div>
  )
})
