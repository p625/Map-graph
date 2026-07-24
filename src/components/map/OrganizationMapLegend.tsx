import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import {
  clampLegendLayoutToBounds,
  computeAutoColumnCount,
  distributeItemsRowMajor,
  legendPositionFromRatios,
  resolveOrganizationLegendSegments,
} from '../../domain/organization/organizationLegendLayout'

interface OrganizationMapLegendProps {
  items: OrganizationLegendItem[]
  settings: OrganizationLegendSettings
  mapWidth: number
  mapHeight: number
}

export function OrganizationMapLegend({
  items,
  settings,
  mapWidth,
  mapHeight,
}: OrganizationMapLegendProps) {
  if (!settings.enabled || items.length === 0) return null

  const layout = clampLegendLayoutToBounds(settings.layout, mapWidth, mapHeight)
  const columnCount = computeAutoColumnCount(layout, items, settings.labelMode, settings.showWorkplaceCount)
  const orderedItems = distributeItemsRowMajor(items, columnCount)
  const { x: left, y: top } = legendPositionFromRatios(layout, {
    viewportWidth: mapWidth,
    viewportHeight: mapHeight,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  const fontSize = layout.fontSizePx
  const swatch = Math.max(8, fontSize)
  const rowHeight = fontSize * 1.35 + layout.rowGapPx + layout.itemGapPx
  const colWidth = layout.width / columnCount
  const background =
    layout.backgroundMode === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'transparent'

  return (
    <g data-layer="organization-legend" pointerEvents="none">
      {background !== 'transparent' && (
        <rect
          x={left}
          y={top}
          width={layout.width}
          height={layout.height}
          fill={background}
          rx={2}
        />
      )}
      {orderedItems.map((item, index) => {
        const col = index % columnCount
        const row = Math.floor(index / columnCount)
        const x = left + col * colWidth + 6
        const y = top + row * rowHeight + fontSize + 4
        const segment = resolveOrganizationLegendSegments(
          item,
          settings.labelMode,
          settings.showWorkplaceCount,
        )
        const swatchX = x
        const textStartX = x + swatch + 6
        const designationWidth =
          segment.showDesignation && segment.designation
            ? segment.designation.length * fontSize * 0.52 + 8
            : 0
        const leaderX = textStartX + designationWidth

        return (
          <g key={item.leaderId}>
            <rect
              x={swatchX}
              y={y - swatch + 2}
              width={swatch}
              height={swatch}
              rx={2}
              fill={item.color}
              stroke="#cbd5e1"
              strokeWidth={0.5}
            />
            {segment.showDesignation && segment.designation && (
              <text
                x={textStartX}
                y={y}
                fontSize={fontSize}
                fontWeight={600}
                fill="#1e293b"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {segment.designation}
              </text>
            )}
            {segment.showLeader && segment.leaderName && (
              <text
                x={leaderX}
                y={y}
                fontSize={fontSize}
                fill="#334155"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {segment.leaderName}
              </text>
            )}
            {segment.showCount && (
              <text
                x={leaderX + (segment.showLeader ? segment.leaderName.length * fontSize * 0.52 + 4 : 0)}
                y={y}
                fontSize={fontSize}
                fill="#64748b"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                ({segment.workplaceCount})
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
