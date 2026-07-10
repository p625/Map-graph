import { forwardRef, useMemo } from 'react'
import type { LayeredBoundaryStrokes } from '../../domain/color/colorEngine'
import type { MapLabel } from '../../domain/labels/labelEngine'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import type { TerritoryFillMap, TerritoryLayers } from '../../domain/territory/types'
import type { WorkplaceResolver } from '../../domain/territory/workplaceResolver'
import { OrganizationMapLegend } from './OrganizationMapLegend'

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
  className?: string
  highlightedDistrictIds?: string[]
  selectedDistrictIds?: string[]
  viewport?: string | null
  interactiveDistrictIds?: Set<string> | null
  onHoverDistrict?: (districtId: string | null) => void
  onSelectDistrict?: (districtId: string | null) => void
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
    className = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
    highlightedDistrictIds = [],
    selectedDistrictIds = [],
    viewport = null,
    interactiveDistrictIds = null,
    onHoverDistrict,
    onSelectDistrict,
  },
  ref,
) {
  const highlightSet = useMemo(() => new Set(highlightedDistrictIds), [highlightedDistrictIds])
  const selectedSet = useMemo(() => new Set(selectedDistrictIds), [selectedDistrictIds])
  const hasHighlight = highlightedDistrictIds.length > 0

  function isDistrictInteractive(districtId: string): boolean {
    if (!interactive) return false
    if (!interactiveDistrictIds) return true
    return interactiveDistrictIds.has(districtId)
  }

  function handleMouseEnter(districtId: string) {
    if (!isDistrictInteractive(districtId)) return
    onHoverDistrict?.(districtId)
  }

  function handleMouseLeave() {
    if (!interactive) return
    onHoverDistrict?.(null)
  }

  function handleClick(districtId: string) {
    if (!isDistrictInteractive(districtId)) return
    onSelectDistrict?.(districtId)
  }

  const viewBox = viewport ?? `0 0 ${width} ${height}`

  return (
    <div ref={ref} className={className}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="auto"
        style={{ display: 'block' }}
        role="img"
        aria-label="Mapa České republiky"
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
                stroke={style?.stroke ?? style?.fill ?? '#f8fafc'}
                strokeWidth={style?.strokeWidth ?? 0.2}
                fillOpacity={style?.opacity ?? 1}
                data-district-id={polygon.entityId}
                data-workplace-id={resolver.getWorkplaceIdForDistrict(polygon.entityId) ?? ''}
                style={{
                  outline: 'none',
                  opacity: interactive && dimmed ? 0.55 : 1,
                  filter: isSelected ? 'brightness(0.92)' : undefined,
                  cursor: districtInteractive ? 'pointer' : interactive ? 'default' : 'default',
                  pointerEvents: districtInteractive || !interactive ? 'auto' : 'none',
                }}
                onMouseEnter={() => handleMouseEnter(polygon.entityId)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(polygon.entityId)}
              />
            )
          })}
        </g>

        {renderBoundaryGroup(boundaryLayers.district, 'district-boundaries')}
        {renderBoundaryGroup(boundaryLayers.workplace, 'workplace-boundaries')}
        {renderBoundaryGroup(boundaryLayers.region, 'region-boundaries')}

        {labels.length > 0 && (
          <g data-layer="labels" pointerEvents="none">
            {labels.filter((label) => label.visible).map((label) => {
              const lines = label.text.split('\n')
              const style = label.style
              const fontSizePx = style.fontSizePx ?? label.fontSize
              return (
                <text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSizePx}
                  fill={style.textColor}
                  stroke={style.haloEnabled ? style.haloColor : undefined}
                  strokeWidth={style.haloEnabled ? style.haloWidth : 0}
                  paintOrder={style.haloEnabled ? 'stroke' : undefined}
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontWeight: style.fontWeight,
                  }}
                >
                  {lines.length === 1 ? (
                    lines[0]
                  ) : (
                    lines.map((line, index) => (
                      <tspan key={index} x={label.x} dy={index === 0 ? 0 : fontSizePx * 1.1}>
                        {line}
                      </tspan>
                    ))
                  )}
                </text>
              )
            })}
          </g>
        )}

        {organizationLegendSettings && (
          <OrganizationMapLegend
            items={organizationLegendItems}
            settings={organizationLegendSettings}
            viewBox={viewBox}
            mapWidth={width}
            mapHeight={height}
          />
        )}
      </svg>
    </div>
  )
})
