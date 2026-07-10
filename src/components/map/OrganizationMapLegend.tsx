import {
  formatOrganizationLegendLabel,
  type OrganizationLegendItem,
  type OrganizationLegendSettings,
} from '../../domain/organization/organizationLegend'

interface OrganizationMapLegendProps {
  items: OrganizationLegendItem[]
  settings: OrganizationLegendSettings
  viewBox: string | null
  mapWidth: number
  mapHeight: number
}

function parseViewBox(viewBox: string | null, width: number, height: number) {
  if (!viewBox) return { x: 0, y: 0, w: width, h: height }
  const parts = viewBox.trim().split(/\s+/).map(Number)
  return {
    x: parts[0] ?? 0,
    y: parts[1] ?? 0,
    w: parts[2] ?? width,
    h: parts[3] ?? height,
  }
}

export function OrganizationMapLegend({
  items,
  settings,
  viewBox,
  mapWidth,
  mapHeight,
}: OrganizationMapLegendProps) {
  if (!settings.enabled || items.length === 0) return null

  const box = parseViewBox(viewBox, mapWidth, mapHeight)
  const fontSize = Math.max(8, Math.min(12, Math.round(box.w * 0.012)))
  const swatch = Math.max(8, fontSize)
  const padding = Math.max(6, Math.round(fontSize * 0.7))
  const lineHeight = fontSize * 1.35
  const textOffset = swatch + 6

  const labels = items.map((item) =>
    formatOrganizationLegendLabel(item, settings.labelMode, settings.showWorkplaceCount),
  )
  const maxTextWidth = labels.reduce((max, label) => Math.max(max, label.length * fontSize * 0.52), 0)
  const legendWidth = Math.min(box.w * 0.38, Math.max(swatch + 8, textOffset + maxTextWidth + padding * 2))
  const legendHeight = padding * 2 + items.length * lineHeight
  const originX = box.x + box.w - legendWidth - padding
  const originY = box.y + padding

  return (
    <g data-layer="organization-legend" pointerEvents="none">
      <rect
        x={originX}
        y={originY}
        width={legendWidth}
        height={legendHeight}
        rx={4}
        fill="rgba(255, 255, 255, 0.92)"
        stroke="#e2e8f0"
        strokeWidth={0.75}
      />
      {items.map((item, index) => {
        const y = originY + padding + index * lineHeight + fontSize * 0.85
        const label = labels[index] ?? ''
        return (
          <g key={item.leaderId}>
            <rect
              x={originX + padding}
              y={y - swatch + 2}
              width={swatch}
              height={swatch}
              rx={2}
              fill={item.color}
              stroke="#cbd5e1"
              strokeWidth={0.5}
            />
            {label && (
              <text
                x={originX + padding + textOffset}
                y={y}
                fontSize={fontSize}
                fill="#1e293b"
                style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 500 }}
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
