import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import topoJson from '../data/geo/cz-districts.topo.json'

const MAP_CENTER: [number, number] = [15.5, 49.75]
const MAP_SCALE = 5500

const topology = topoJson as unknown as Topology
const okresyObject = (topoJson as { objects: { okresy: unknown } }).objects.okresy

export const districtFeatureCollection = feature(
  topology,
  okresyObject as Parameters<typeof feature>[1],
) as FeatureCollection<Geometry>

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function projectPoint(
  lon: number,
  lat: number,
  width: number,
  height: number,
): [number, number] {
  const centerLon = toRadians(MAP_CENTER[0])
  const centerLat = toRadians(MAP_CENTER[1])
  const λ = toRadians(lon)
  const φ = toRadians(lat)

  const x = MAP_SCALE * (λ - centerLon)
  const y =
    MAP_SCALE *
    (Math.log(Math.tan(Math.PI / 4 + φ / 2)) - Math.log(Math.tan(Math.PI / 4 + centerLat / 2)))

  return [width / 2 + x, height / 2 - y]
}

function ringToPath(ring: Position[], width: number, height: number): string {
  if (ring.length === 0) return ''

  const commands = ring.map((coord, index) => {
    const [x, y] = projectPoint(coord[0]!, coord[1]!, width, height)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  })

  return `${commands.join(' ')} Z`
}

export function geometryToSvgPath(geometry: Geometry, width: number, height: number): string {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates.map((ring) => ringToPath(ring, width, height)).join(' ')
    case 'MultiPolygon':
      return geometry.coordinates
        .map((polygon) => polygon.map((ring) => ringToPath(ring, width, height)).join(' '))
        .join(' ')
    default:
      return ''
  }
}

export function featureToSvgPath(featureGeometry: Feature<Geometry>, width: number, height: number): string {
  return geometryToSvgPath(featureGeometry.geometry, width, height)
}

export function getFeatureGeoId(featureItem: Feature<Geometry>): string {
  const props = featureItem.properties as { id?: string } | null
  return String(props?.id ?? featureItem.id ?? '')
}
