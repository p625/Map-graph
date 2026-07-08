import { forwardRef, useMemo, useState } from 'react'
import { districts } from '../../data/seed/districts'
import type { DistrictColorMap } from '../../domain/visualization/types'
import { DEFAULT_STROKE } from '../../domain/visualization/colorUtils'
import { useConfigState } from '../../store/configStore'
import { useMapActions } from '../../store/mapStore'
import {
  districtFeatureCollection,
  featureToSvgPath,
  getFeatureGeoId,
} from '../../utils/districtGeometries'

interface CzechMapProps {
  colors: DistrictColorMap
  interactive?: boolean
  width?: number
  height?: number
  className?: string
  strokeColor?: string
}

const districtByGeoId = new Map(districts.map((district) => [district.geoFeatureId, district]))

export const CzechMap = forwardRef<HTMLDivElement, CzechMapProps>(function CzechMap(
  {
    colors,
    interactive = true,
    width = 760,
    height = 460,
    className = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
    strokeColor,
  },
  ref,
) {
  const { districtWorkplaceAssignments } = useConfigState()
  const { setHoveredPolygon, clearHoveredPolygon } = useMapActions()
  const [hoveredGeoId, setHoveredGeoId] = useState<string | null>(null)

  const paths = useMemo(
    () =>
      districtFeatureCollection.features.map((geoFeature) => ({
        geoId: getFeatureGeoId(geoFeature),
        d: featureToSvgPath(geoFeature, width, height),
      })),
    [width, height],
  )

  function handleMouseEnter(geoId: string, districtId: string | undefined, workplaceId: string | null) {
    if (!interactive || !districtId) return
    setHoveredGeoId(geoId)
    setHoveredPolygon({
      workplaceId,
      districtIds: workplaceId
        ? districts
            .filter((item) => districtWorkplaceAssignments[item.id] === workplaceId)
            .map((item) => item.id)
        : [districtId],
    })
  }

  function handleMouseLeave() {
    if (!interactive) return
    setHoveredGeoId(null)
    clearHoveredPolygon()
  }

  return (
    <div ref={ref} className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ display: 'block' }}
        role="img"
        aria-label="Mapa okresů České republiky"
      >
        {paths.map(({ geoId, d }) => {
          const district = districtByGeoId.get(geoId)
          const districtId = district?.id
          const style = districtId ? colors[districtId] : undefined
          const fill = style?.fill ?? '#f8fafc'
          const workplaceId = districtId
            ? districtWorkplaceAssignments[districtId] ?? null
            : null

          const stroke = workplaceId ? fill : (style?.stroke ?? strokeColor ?? DEFAULT_STROKE)
          const strokeWidth = workplaceId ? 0.2 : 0.6
          const isHovered = hoveredGeoId === geoId

          return (
            <path
              key={geoId}
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={{
                outline: 'none',
                opacity: interactive && isHovered ? 0.85 : 1,
                cursor: interactive && districtId ? 'pointer' : 'default',
              }}
              onMouseEnter={() => handleMouseEnter(geoId, districtId, workplaceId)}
              onMouseLeave={handleMouseLeave}
            />
          )
        })}
      </svg>
    </div>
  )
})
