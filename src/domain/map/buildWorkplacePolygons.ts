import { featureCollection } from '@turf/helpers'
import union from '@turf/union'
import { feature } from 'topojson-client'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from 'geojson'
import type { Topology } from 'topojson-specification'
import topoJson from '../../data/geo/cz-districts.topo.json'
import { districts } from '../../data/seed/districts'
import type { DistrictWorkplaceAssignments } from '../types/assignment'
import type { DistrictColorMap, DistrictStyle } from '../visualization/types'
import { DEFAULT_STROKE, NO_DATA_FILL } from '../visualization/colorUtils'

export interface MapPolygon {
  id: string
  workplaceId: string | null
  districtIds: string[]
  districtNames: string[]
  geometry: Polygon | MultiPolygon
  style: DistrictStyle
}

const districtByGeoId = new Map(districts.map((district) => [district.geoFeatureId, district]))

const topology = topoJson as unknown as Topology
const okresyObject = (topoJson as { objects: { okresy: unknown } }).objects.okresy

const districtFeatures = feature(
  topology,
  okresyObject as Parameters<typeof feature>[1],
) as unknown as FeatureCollection<Polygon | MultiPolygon>

const featureByDistrictId = new Map<string, Feature<Polygon | MultiPolygon>>()

for (const districtFeature of districtFeatures.features) {
  const geoId = String(districtFeature.properties?.id ?? '')
  const district = districtByGeoId.get(geoId)
  if (district) {
    featureByDistrictId.set(district.id, districtFeature)
  }
}

function unionDistrictFeatures(
  features: Feature<Polygon | MultiPolygon>[],
): Feature<Polygon | MultiPolygon> | null {
  if (features.length === 0) return null
  if (features.length === 1) return features[0]!

  let merged: Feature<Polygon | MultiPolygon> | null = features[0]!

  for (let index = 1; index < features.length; index += 1) {
    const next = features[index]!
    if (!merged) return next

    const result = union(featureCollection([merged, next])) as Feature<Polygon | MultiPolygon> | null
    merged = result ?? merged
  }

  return merged
}

function resolvePolygonStyle(
  districtIds: string[],
  colors: DistrictColorMap,
): DistrictStyle {
  for (const districtId of districtIds) {
    const style = colors[districtId]
    if (style) return style
  }

  return { fill: NO_DATA_FILL, stroke: DEFAULT_STROKE }
}

export function buildWorkplacePolygons(
  assignments: DistrictWorkplaceAssignments,
  colors: DistrictColorMap,
): MapPolygon[] {
  const groups = new Map<string, string[]>()
  const unassignedDistrictIds: string[] = []

  for (const district of districts) {
    const workplaceId = assignments[district.id]
    if (!workplaceId) {
      unassignedDistrictIds.push(district.id)
      continue
    }

    const current = groups.get(workplaceId) ?? []
    current.push(district.id)
    groups.set(workplaceId, current)
  }

  const polygons: MapPolygon[] = []

  for (const [workplaceId, districtIds] of groups) {
    const features = districtIds
      .map((districtId) => featureByDistrictId.get(districtId))
      .filter((item): item is Feature<Polygon | MultiPolygon> => Boolean(item))

    const merged = unionDistrictFeatures(features)
    if (!merged?.geometry) continue

    const geometry = merged.geometry
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue

    polygons.push({
      id: `workplace-${workplaceId}`,
      workplaceId,
      districtIds,
      districtNames: districtIds.map(
        (districtId) => districts.find((district) => district.id === districtId)?.name ?? districtId,
      ),
      geometry,
      style: resolvePolygonStyle(districtIds, colors),
    })
  }

  for (const districtId of unassignedDistrictIds) {
    const districtFeature = featureByDistrictId.get(districtId)
    if (!districtFeature?.geometry) continue

    const geometry = districtFeature.geometry
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue

    const district = districts.find((item) => item.id === districtId)

    polygons.push({
      id: `district-${districtId}`,
      workplaceId: null,
      districtIds: [districtId],
      districtNames: [district?.name ?? districtId],
      geometry,
      style: colors[districtId] ?? { fill: NO_DATA_FILL, stroke: DEFAULT_STROKE },
    })
  }

  return polygons
}

export function toRenderableGeography(polygon: MapPolygon): Feature<Geometry> {
  return {
    type: 'Feature',
    properties: {
      id: polygon.id,
      workplaceId: polygon.workplaceId,
      districtIds: polygon.districtIds,
      districtNames: polygon.districtNames,
      fill: polygon.style.fill,
      stroke: polygon.style.stroke,
    },
    geometry: polygon.geometry,
  }
}

export function toFeatureCollection(polygons: MapPolygon[]): FeatureCollection<Geometry> {
  return {
    type: 'FeatureCollection',
    features: polygons.map(toRenderableGeography),
  }
}
