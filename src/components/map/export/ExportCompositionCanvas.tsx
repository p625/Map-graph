import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { LayeredBoundaryStrokes } from '../../../domain/color/colorEngine'
import {
  EXPORT_CANVAS_PADDING_PX,
  clampRectToCanvas,
  rectRatiosFromPosition,
  resolveExportLegendRect,
  resolveExportMapRect,
  resolveExportTitleRect,
  resolveLegendWidthForComposition,
  type ExportCompositionLayout,
  type ExportCompositionSelection,
  type ExportRect,
} from '../../../domain/export/exportCompositionLayout'
import type { MapLabel } from '../../../domain/labels/labelEngine'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../../domain/organization/organizationLegend'
import {
  extractLegendStyleTokens,
  scaleLegendStyleTokens,
} from '../../../domain/organization/organizationLegendStyle'
import type { TerritoryFillMap, TerritoryLayers } from '../../../domain/territory/types'
import type { WorkplaceResolver } from '../../../domain/territory/workplaceResolver'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { LegendSpec } from '../../../domain/visualization/types'
import {
  estimateLegendContentHeight,
  OrganizationLegendContent,
} from '../OrganizationLegendContent'
import { CzechMap } from '../CzechMap'
import { ExportMapLegend } from './ExportMapLegend'

export type { ExportCompositionSelection } from '../../../domain/export/exportCompositionLayout'

interface ExportCompositionCanvasProps {
  canvasWidth: number
  canvasHeight: number
  previewScale?: number
  composition: ExportCompositionLayout
  interactive?: boolean
  selectedElement?: ExportCompositionSelection
  onSelectElement?: (selection: ExportCompositionSelection) => void
  onCompositionChange?: (composition: ExportCompositionLayout) => void
  titleText: string
  subtitleText?: string
  showDataLegend: boolean
  showDatasetInfo: boolean
  dataLegend: LegendSpec
  dataset?: Dataset
  column?: DatasetColumn
  pluginName?: string
  themeName?: string
  createdAt?: Date
  orgLegendItems: OrganizationLegendItem[]
  orgLegendSettings?: OrganizationLegendSettings
  territories: TerritoryLayers
  fillStyles: TerritoryFillMap
  boundaryLayers: LayeredBoundaryStrokes
  labels: MapLabel[]
  resolver: WorkplaceResolver
  viewport: string | null
  mapRenderWidth: number
  mapRenderHeight: number
}

type DragMode =
  | { kind: 'move'; target: Exclude<ExportCompositionSelection, null> }
  | { kind: 'resize-width'; target: 'legend' | 'title' }
  | { kind: 'resize-map'; target: 'map' }
  | { kind: 'resize-scale'; target: 'legend' }

export function ExportCompositionCanvas({
  canvasWidth,
  canvasHeight,
  previewScale = 1,
  composition,
  interactive = false,
  selectedElement = null,
  onSelectElement,
  onCompositionChange,
  titleText,
  subtitleText,
  showDataLegend,
  showDatasetInfo,
  dataLegend,
  dataset,
  column,
  pluginName,
  themeName,
  createdAt = new Date(),
  orgLegendItems,
  orgLegendSettings,
  territories,
  fillStyles,
  boundaryLayers,
  labels,
  resolver,
  viewport,
  mapRenderWidth,
  mapRenderHeight,
}: ExportCompositionCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    originRect: ExportRect
    originScale: number
  } | null>(null)

  const renderContext = useMemo(
    () => ({ canvasWidth, canvasHeight, composition }),
    [canvasHeight, canvasWidth, composition],
  )

  const mapRect = useMemo(() => resolveExportMapRect(renderContext), [renderContext])
  const titleRect = useMemo(() => resolveExportTitleRect(renderContext), [renderContext])

  const baseLegendTokens = useMemo(
    () =>
      orgLegendSettings
        ? extractLegendStyleTokens(orgLegendSettings.layout)
        : extractLegendStyleTokens({
            fontSizePx: 9,
            itemGapPx: 4,
            columnGapPx: 14,
            rowGapPx: 2,
            maxColumns: 4,
            backgroundMode: 'transparent',
          }),
    [orgLegendSettings],
  )

  const scaledLegendTokens = useMemo(
    () => scaleLegendStyleTokens(baseLegendTokens, composition.organizationalLegend.contentScale),
    [baseLegendTokens, composition.organizationalLegend.contentScale],
  )

  const legendWidth = useMemo(
    () => resolveLegendWidthForComposition(renderContext),
    [renderContext],
  )

  const legendContentHeight = useMemo(() => {
    if (!orgLegendSettings || orgLegendItems.length === 0) return 80
    return estimateLegendContentHeight(orgLegendItems, orgLegendSettings, legendWidth, scaledLegendTokens)
  }, [legendWidth, orgLegendItems, orgLegendSettings, scaledLegendTokens])

  const legendRect = useMemo(
    () => resolveExportLegendRect(renderContext, legendWidth, legendContentHeight),
    [legendContentHeight, legendWidth, renderContext],
  )

  const scaledFontSize = (value: number) => (previewScale < 1 ? value * previewScale : value)

  const commitComposition = useCallback(
    (next: ExportCompositionLayout) => {
      onCompositionChange?.({ ...next, presetId: 'custom' })
    },
    [onCompositionChange],
  )

  useEffect(() => {
    if (!interactive) return

    function onPointerMove(event: PointerEvent) {
      if (!dragRef.current) return
      const dx = (event.clientX - dragRef.current.startX) / previewScale
      const dy = (event.clientY - dragRef.current.startY) / previewScale
      const origin = dragRef.current.originRect

      if (dragRef.current.mode.kind === 'move') {
        const nextRect = clampRectToCanvas(canvasWidth, canvasHeight, {
          ...origin,
          x: origin.x + dx,
          y: origin.y + dy,
        })
        const ratios = rectRatiosFromPosition(canvasWidth, canvasHeight, nextRect)
        if (dragRef.current.mode.target === 'map') {
          commitComposition({ ...composition, map: { ...composition.map, ...ratios } })
        } else if (dragRef.current.mode.target === 'title') {
          commitComposition({ ...composition, title: { ...composition.title, ...ratios } })
        } else {
          commitComposition({
            ...composition,
            organizationalLegend: {
              ...composition.organizationalLegend,
              xRatio: ratios.xRatio,
              yRatio: ratios.yRatio,
              inheritPositionFromEditor: false,
            },
          })
        }
        return
      }

      if (dragRef.current.mode.kind === 'resize-width') {
        const nextRect = clampRectToCanvas(canvasWidth, canvasHeight, {
          ...origin,
          width: Math.max(80, origin.width + dx),
        })
        const ratios = rectRatiosFromPosition(canvasWidth, canvasHeight, nextRect)
        if (dragRef.current.mode.target === 'title') {
          commitComposition({
            ...composition,
            title: { ...composition.title, widthRatio: ratios.widthRatio },
          })
        } else {
          commitComposition({
            ...composition,
            organizationalLegend: {
              ...composition.organizationalLegend,
              widthRatio: ratios.widthRatio,
              inheritSizeFromEditor: false,
              inheritPositionFromEditor: false,
            },
          })
        }
        return
      }

      if (dragRef.current.mode.kind === 'resize-map') {
        const nextRect = clampRectToCanvas(canvasWidth, canvasHeight, {
          ...origin,
          width: Math.max(120, origin.width + dx),
          height: Math.max(90, origin.height + dy),
        })
        const ratios = rectRatiosFromPosition(canvasWidth, canvasHeight, nextRect)
        commitComposition({ ...composition, map: { ...composition.map, ...ratios } })
        return
      }

      if (dragRef.current.mode.kind === 'resize-scale') {
        const scaleDelta = dx / 200
        const nextScale = Math.max(0.5, Math.min(2.5, dragRef.current.originScale + scaleDelta))
        commitComposition({
          ...composition,
          organizationalLegend: {
            ...composition.organizationalLegend,
            contentScale: Math.round(nextScale * 100) / 100,
            inheritSizeFromEditor: false,
          },
        })
      }
    }

    function onPointerUp() {
      dragRef.current = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvasHeight, canvasWidth, commitComposition, composition, interactive, previewScale])

  function startDrag(mode: DragMode, event: React.PointerEvent, originRect: ExportRect, originScale = 1) {
    if (!interactive) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originRect,
      originScale,
    }
    if (mode.kind === 'resize-scale') onSelectElement?.('legend')
    else onSelectElement?.(mode.target)
  }

  const titleDisplay = composition.title.text || titleText

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
      data-layer="export-composition-canvas"
      onPointerDown={() => interactive && onSelectElement?.(null)}
    >
      {composition.title.visible && titleDisplay && (
        <div
          style={{
            position: 'absolute',
            left: titleRect.x,
            top: titleRect.y,
            width: titleRect.width,
            fontSize: scaledFontSize(composition.title.fontSize),
            fontWeight: composition.title.fontWeight,
            textAlign: composition.title.textAlign,
            color: '#0f172a',
            lineHeight: 1.2,
            zIndex: 30,
            boxSizing: 'border-box',
            outline:
              interactive && selectedElement === 'title'
                ? '1px dashed rgba(59, 130, 246, 0.8)'
                : undefined,
          }}
          data-layer="export-title"
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelectElement?.('title')
            startDrag({ kind: 'move', target: 'title' }, event, titleRect)
          }}
        >
          <div>{titleDisplay}</div>
          {subtitleText?.trim() && (
            <div
              style={{
                marginTop: scaledFontSize(composition.title.fontSize * 0.25),
                fontSize: scaledFontSize(Math.max(12, composition.title.fontSize * 0.55)),
                fontWeight: 400,
                color: '#475569',
              }}
            >
              {subtitleText}
            </div>
          )}
          {interactive && selectedElement === 'title' && (
            <div
              className="absolute bottom-0 right-0 h-3 w-3 cursor-ew-resize rounded-sm bg-blue-500/70"
              onPointerDown={(event) =>
                startDrag({ kind: 'resize-width', target: 'title' }, event, titleRect)
              }
            />
          )}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: mapRect.x,
          top: mapRect.y,
          width: mapRect.width,
          height: mapRect.height,
          zIndex: 10,
          outline:
            interactive && selectedElement === 'map'
              ? '1px dashed rgba(59, 130, 246, 0.8)'
              : undefined,
        }}
        data-layer="export-map-frame"
        onPointerDown={(event) => {
          event.stopPropagation()
          onSelectElement?.('map')
          startDrag({ kind: 'move', target: 'map' }, event, mapRect)
        }}
      >
        <CzechMap
          territories={territories}
          fillStyles={fillStyles}
          boundaryLayers={boundaryLayers}
          labels={labels}
          resolver={resolver}
          interactive={false}
          width={mapRenderWidth}
          height={mapRenderHeight}
          viewport={viewport}
          className=""
        />
        {interactive && selectedElement === 'map' && (
          <div
            className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm bg-blue-500/70"
            onPointerDown={(event) =>
              startDrag({ kind: 'resize-map', target: 'map' }, event, mapRect)
            }
          />
        )}
      </div>

      {composition.organizationalLegend.visible &&
        orgLegendSettings &&
        orgLegendItems.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: legendRect.x,
              top: legendRect.y,
              width: legendRect.width,
              zIndex: 20,
              outline:
                interactive && selectedElement === 'legend'
                  ? '1px dashed rgba(59, 130, 246, 0.8)'
                  : undefined,
            }}
            data-layer="export-org-legend-frame"
            onPointerDown={(event) => {
              event.stopPropagation()
              onSelectElement?.('legend')
              startDrag({ kind: 'move', target: 'legend' }, event, legendRect)
            }}
          >
            {interactive && (
              <div
                className="mb-1 h-3 cursor-grab rounded bg-slate-200/70 active:cursor-grabbing"
                onPointerDown={(event) =>
                  startDrag({ kind: 'move', target: 'legend' }, event, legendRect)
                }
              />
            )}
            <OrganizationLegendContent
              items={orgLegendItems}
              settings={orgLegendSettings}
              width={legendRect.width}
              styleTokens={scaledLegendTokens}
            />
            {interactive && selectedElement === 'legend' && (
              <>
                <div
                  className="absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500/70"
                  onPointerDown={(event) =>
                    startDrag({ kind: 'resize-width', target: 'legend' }, event, legendRect)
                  }
                />
                <div
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-sm bg-emerald-500/70"
                  title="Změnit celkové měřítko obsahu"
                  onPointerDown={(event) =>
                    startDrag(
                      { kind: 'resize-scale', target: 'legend' },
                      event,
                      legendRect,
                      composition.organizationalLegend.contentScale,
                    )
                  }
                />
              </>
            )}
          </div>
        )}

      {showDataLegend && (
        <div
          style={{
            position: 'absolute',
            right: EXPORT_CANVAS_PADDING_PX + 8,
            top: EXPORT_CANVAS_PADDING_PX + 8,
            maxWidth: Math.max(140, Math.round(canvasWidth * 0.18)),
            zIndex: 15,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            padding: 8,
            borderRadius: 4,
          }}
          data-layer="export-data-legend"
        >
          <ExportMapLegend legend={dataLegend} compact={canvasWidth < 1600} />
          {showDatasetInfo && (
            <div
              style={{
                marginTop: 12,
                borderTop: '1px solid #e2e8f0',
                paddingTop: 8,
                fontSize: scaledFontSize(Math.max(11, canvasWidth * 0.011)),
                color: '#475569',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Dataset</p>
              {dataset ? (
                <>
                  <p style={{ margin: '4px 0 0' }}>{dataset.name}</p>
                  {column && <p style={{ margin: '2px 0 0' }}>Sloupec: {column.name}</p>}
                </>
              ) : (
                <p style={{ margin: '4px 0 0' }}>{pluginName ?? 'Organizační vizualizace'}</p>
              )}
              {themeName && <p style={{ margin: '2px 0 0' }}>Téma: {themeName}</p>}
              <p style={{ margin: '6px 0 0', color: '#64748b' }}>
                Vytvořeno: {createdAt.toLocaleDateString('cs-CZ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
