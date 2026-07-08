import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import topoJson from '../../data/geo/cz-districts.topo.json'
import { districts } from '../../data/seed/districts'
import type { DistrictColorMap } from '../../domain/visualization/types'
import { DEFAULT_STROKE } from '../../domain/visualization/colorUtils'
import { useConfigState } from '../../store/configStore'
import { useMapActions } from '../../store/mapStore'

interface CzechMapProps {
  colors: DistrictColorMap
}

const districtByGeoId = new Map(districts.map((district) => [district.geoFeatureId, district]))

export function CzechMap({ colors }: CzechMapProps) {
  const { districtWorkplaceAssignments } = useConfigState()
  const { setHoveredPolygon, clearHoveredPolygon } = useMapActions()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [15.5, 49.75], scale: 5500 }}
        width={760}
        height={460}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={topoJson}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoId = String(geo.properties?.id ?? geo.id)
              const district = districtByGeoId.get(geoId)
              const districtId = district?.id
              const style = districtId ? colors[districtId] : undefined
              const fill = style?.fill ?? '#f8fafc'
              const workplaceId = districtId
                ? districtWorkplaceAssignments[districtId] ?? null
                : null

              // Okresy stejného pracoviště vizuálně spojíme skrytím vnitřních hranic.
              const stroke = workplaceId ? fill : (style?.stroke ?? DEFAULT_STROKE)

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={workplaceId ? 0.2 : 0.6}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', opacity: 0.85, cursor: 'pointer' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={() => {
                    if (!districtId) return
                    setHoveredPolygon({
                      workplaceId,
                      districtIds: workplaceId
                        ? districts
                            .filter(
                              (item) => districtWorkplaceAssignments[item.id] === workplaceId,
                            )
                            .map((item) => item.id)
                        : [districtId],
                    })
                  }}
                  onMouseLeave={() => clearHoveredPolygon()}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  )
}
