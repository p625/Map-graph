import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import {
  clampLegendLayoutToBounds,
  computeAutoColumnCount,
  distributeItemsRowMajor,
  legendPositionFromRatios,
  legendRatiosFromPosition,
  type OrganizationLegendLayout,
} from '../../domain/organization/organizationLegendLayout'
import { useMapActions } from '../../store/mapStore'
import { OrganizationLegendItemRow } from './OrganizationLegendItemRow'

interface OrganizationLegendOverlayProps {
  items: OrganizationLegendItem[]
  settings: OrganizationLegendSettings
  interactive?: boolean
  onLayoutCommit?: (layout: OrganizationLegendLayout) => void
}

export function OrganizationLegendOverlay({
  items,
  settings,
  interactive = true,
  onLayoutCommit,
}: OrganizationLegendOverlayProps) {
  const { updateOrganizationLegend } = useMapActions()
  const layout = settings.layout
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  )
  const resizeRef = useRef<{
    startX: number
    startY: number
    originW: number
    originH: number
  } | null>(null)
  const pendingLayoutRef = useRef<Partial<OrganizationLegendLayout> | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null)
  const [localLayoutPatch, setLocalLayoutPatch] = useState<Partial<OrganizationLegendLayout> | null>(
    null,
  )

  useEffect(() => {
    const viewport = rootRef.current?.parentElement
    if (!viewport) return

    const updateViewportSize = () => {
      const rect = viewport.getBoundingClientRect()
      setViewportSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const effectiveLayout = useMemo(
    () => ({
      ...layout,
      ...(localLayoutPatch ?? {}),
    }),
    [layout, localLayoutPatch],
  )

  const fallbackViewportWidth = layout.width + 48
  const fallbackViewportHeight = layout.height + 48
  const viewportWidth = viewportSize.width || fallbackViewportWidth
  const viewportHeight = viewportSize.height || fallbackViewportHeight

  const clampedLayout = useMemo(
    () => clampLegendLayoutToBounds(effectiveLayout, viewportWidth, viewportHeight),
    [effectiveLayout, viewportHeight, viewportWidth],
  )

  const columnCount = useMemo(
    () => computeAutoColumnCount(clampedLayout, items, settings.labelMode, settings.showWorkplaceCount),
    [clampedLayout, items, settings.labelMode, settings.showWorkplaceCount],
  )

  const orderedItems = useMemo(
    () => distributeItemsRowMajor(items, columnCount),
    [items, columnCount],
  )

  const bounds = useMemo(
    () => ({
      viewportWidth,
      viewportHeight,
      legendWidth: clampedLayout.width,
      legendHeight: clampedLayout.height,
    }),
    [clampedLayout.height, clampedLayout.width, viewportHeight, viewportWidth],
  )

  const storedPosition = useMemo(
    () => legendPositionFromRatios(clampedLayout, bounds),
    [bounds, clampedLayout],
  )

  const position = localPosition ?? storedPosition

  const flushPendingLayout = useCallback(() => {
    if (!pendingLayoutRef.current) return
    const nextLayout = clampLegendLayoutToBounds(
      { ...layout, ...pendingLayoutRef.current },
      viewportWidth,
      viewportHeight,
    )
    if (onLayoutCommit) {
      onLayoutCommit(nextLayout)
    } else {
      updateOrganizationLegend({ layout: nextLayout })
    }
    pendingLayoutRef.current = null
  }, [layout, onLayoutCommit, updateOrganizationLegend, viewportHeight, viewportWidth])

  useEffect(() => {
    if (onLayoutCommit || dragging || viewportSize.width <= 0 || viewportSize.height <= 0) return
    const clamped = clampLegendLayoutToBounds(layout, viewportSize.width, viewportSize.height)
    const needsUpdate =
      Math.abs(clamped.xRatio - layout.xRatio) > 0.0001 ||
      Math.abs(clamped.yRatio - layout.yRatio) > 0.0001 ||
      Math.abs(clamped.widthRatio - layout.widthRatio) > 0.0001 ||
      Math.abs(clamped.heightRatio - layout.heightRatio) > 0.0001 ||
      clamped.width !== layout.width ||
      clamped.height !== layout.height
    if (needsUpdate) {
      updateOrganizationLegend({ layout: clamped })
    }
  }, [dragging, layout, onLayoutCommit, updateOrganizationLegend, viewportSize.height, viewportSize.width])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (dragRef.current) {
        const dx = event.clientX - dragRef.current.startX
        const dy = event.clientY - dragRef.current.startY
        const nextX = dragRef.current.originX + dx
        const nextY = dragRef.current.originY + dy
        const ratios = legendRatiosFromPosition(nextX, nextY, bounds)
        const clampedPosition = legendPositionFromRatios(ratios, bounds)
        setLocalPosition(clampedPosition)
        pendingLayoutRef.current = {
          xRatio: ratios.xRatio,
          yRatio: ratios.yRatio,
          xPercent: Math.round(ratios.xRatio * 100),
          yPercent: Math.round(ratios.yRatio * 100),
        }
      }
      if (resizeRef.current) {
        const dx = event.clientX - resizeRef.current.startX
        const dy = event.clientY - resizeRef.current.startY
        const nextWidth = resizeRef.current.originW + dx
        const nextHeight = resizeRef.current.originH + dy
        const nextLayout = clampLegendLayoutToBounds(
          { ...layout, width: nextWidth, height: nextHeight },
          bounds.viewportWidth,
          bounds.viewportHeight,
        )
        setLocalLayoutPatch({
          width: nextLayout.width,
          height: nextLayout.height,
        })
        pendingLayoutRef.current = {
          width: nextLayout.width,
          height: nextLayout.height,
          xRatio: nextLayout.xRatio,
          yRatio: nextLayout.yRatio,
          widthRatio: nextLayout.widthRatio,
          heightRatio: nextLayout.heightRatio,
          xPercent: nextLayout.xPercent,
          yPercent: nextLayout.yPercent,
        }
      }
    }

    function onPointerUp() {
      const wasDragging = dragRef.current !== null || resizeRef.current !== null
      dragRef.current = null
      resizeRef.current = null
      setDragging(false)
      setLocalPosition(null)
      setLocalLayoutPatch(null)
      if (wasDragging) flushPendingLayout()
    }

    function onPointerCancel() {
      pendingLayoutRef.current = null
      dragRef.current = null
      resizeRef.current = null
      setDragging(false)
      setLocalPosition(null)
      setLocalLayoutPatch(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [bounds, flushPendingLayout, layout])

  if (!settings.enabled || items.length === 0) return null

  const background =
    layout.backgroundMode === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'transparent'

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20" data-layer="organization-legend-layer">
      <div
        className="absolute select-none"
        style={{
          left: position.x,
          top: position.y,
          width: clampedLayout.width,
          height: clampedLayout.height,
          background,
          padding: 6,
          boxSizing: 'border-box',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
        data-layer="organization-legend-overlay"
      >
        {interactive && (
          <div
            className="mb-1 h-3 cursor-grab rounded bg-slate-200/60 active:cursor-grabbing"
            title="Přesunout legendu"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              dragRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originX: position.x,
                originY: position.y,
              }
              setDragging(true)
            }}
          />
        )}

        <div
          className="overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            columnGap: layout.columnGapPx,
            rowGap: layout.rowGapPx + layout.itemGapPx,
            maxHeight: interactive ? 'calc(100% - 20px)' : '100%',
          }}
        >
          {orderedItems.map((item) => (
            <OrganizationLegendItemRow
              key={item.leaderId}
              item={item}
              labelMode={settings.labelMode}
              showWorkplaceCount={settings.showWorkplaceCount}
              fontSizePx={layout.fontSizePx}
            />
          ))}
        </div>

        {interactive && (
          <div
            className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-sm bg-slate-400/70"
            title="Změnit velikost legendy"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              resizeRef.current = {
                startX: event.clientX,
                startY: event.clientY,
                originW: clampedLayout.width,
                originH: clampedLayout.height,
              }
              setDragging(true)
            }}
          />
        )}

        {dragging && <span className="sr-only">Upravuji legendu</span>}
      </div>
    </div>
  )
}
