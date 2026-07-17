import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import {
  clampLegendLayoutToBounds,
  computeAutoColumnCount,
  distributeItemsRowMajor,
} from '../../domain/organization/organizationLegendLayout'
import { useMapActions } from '../../store/mapStore'
import { OrganizationLegendItemRow } from './OrganizationLegendItemRow'

interface OrganizationLegendOverlayProps {
  items: OrganizationLegendItem[]
  settings: OrganizationLegendSettings
  containerWidth: number
  containerHeight: number
  interactive?: boolean
}

export function OrganizationLegendOverlay({
  items,
  settings,
  containerWidth,
  containerHeight,
  interactive = true,
}: OrganizationLegendOverlayProps) {
  const { updateOrganizationLegend } = useMapActions()
  const layout = settings.layout
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  )
  const resizeRef = useRef<{
    startX: number
    startY: number
    originW: number
    originH: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampedLayout = useMemo(
    () => clampLegendLayoutToBounds(layout, containerWidth, containerHeight),
    [layout, containerWidth, containerHeight],
  )

  const columnCount = useMemo(
    () => computeAutoColumnCount(clampedLayout, items, settings.labelMode, settings.showWorkplaceCount),
    [clampedLayout, items, settings.labelMode, settings.showWorkplaceCount],
  )

  const orderedItems = useMemo(
    () => distributeItemsRowMajor(items, columnCount),
    [items, columnCount],
  )

  const left = (clampedLayout.xPercent / 100) * containerWidth
  const top = (clampedLayout.yPercent / 100) * containerHeight

  const persistLayout = useCallback(
    (patch: Partial<typeof layout>) => {
      updateOrganizationLegend({
        layout: clampLegendLayoutToBounds(
          { ...layout, ...patch },
          containerWidth,
          containerHeight,
        ),
      })
    },
    [layout, containerWidth, containerHeight, updateOrganizationLegend],
  )

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (dragRef.current) {
        const dx = event.clientX - dragRef.current.startX
        const dy = event.clientY - dragRef.current.startY
        const nextX = dragRef.current.originX + dx
        const nextY = dragRef.current.originY + dy
        persistLayout({
          xPercent: (nextX / containerWidth) * 100,
          yPercent: (nextY / containerHeight) * 100,
        })
      }
      if (resizeRef.current) {
        const dx = event.clientX - resizeRef.current.startX
        const dy = event.clientY - resizeRef.current.startY
        persistLayout({
          width: resizeRef.current.originW + dx,
          height: resizeRef.current.originH + dy,
        })
      }
    }

    function onPointerUp() {
      dragRef.current = null
      resizeRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [containerWidth, containerHeight, persistLayout])

  if (!settings.enabled || items.length === 0) return null

  const background =
    layout.backgroundMode === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'transparent'

  return (
    <div
      className="absolute z-20 select-none"
      style={{
        left,
        top,
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
            dragRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: left,
              originY: top,
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
  )
}
