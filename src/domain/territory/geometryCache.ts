import { featureCollection } from '@turf/helpers'
import union from '@turf/union'
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from 'geojson'
import { districts } from '../../data/seed/districts'
import {
  districtFeatureCollection,
  geometryToSvgPath,
  getFeatureGeoId,
  projectPoint,
} from '../../utils/districtGeometries'

type PolygonGeometry = Polygon | MultiPolygon
type DistrictFeature = Feature<PolygonGeometry>

const districtByGeoId = new Map(districts.map((district) => [district.geoFeatureId, district]))

const districtFeaturesById = new Map<string, DistrictFeature>()

for (const geoFeature of districtFeatureCollection.features) {
  const geoId = getFeatureGeoId(geoFeature)
  const district = districtByGeoId.get(geoId)
  if (!district) continue
  if (geoFeature.geometry.type !== 'Polygon' && geoFeature.geometry.type !== 'MultiPolygon') continue
  districtFeaturesById.set(district.id, geoFeature as DistrictFeature)
}

function unionFeatures(features: DistrictFeature[]): DistrictFeature | null {
  if (features.length === 0) return null
  if (features.length === 1) return features[0]!

  let merged: DistrictFeature | null = features[0]!

  for (let index = 1; index < features.length; index += 1) {
    const next = features[index]!
    if (!merged) return next
    const result = union(featureCollection([merged, next])) as DistrictFeature | null
    merged = result ?? merged
  }

  return merged
}

function collectPositions(geometry: PolygonGeometry): Position[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat()
  }
  return geometry.coordinates.flat(2)
}

function computeCentroid(geometry: PolygonGeometry, width: number, height: number): [number, number] {
  const positions = collectPositions(geometry)
  if (positions.length === 0) return [width / 2, height / 2]

  let sumX = 0
  let sumY = 0
  for (const coord of positions) {
    const [x, y] = projectPoint(coord[0]!, coord[1]!, width, height)
    sumX += x
    sumY += y
  }

  return [sumX / positions.length, sumY / positions.length]
}

function projectRing(ring: Position[], width: number, height: number): [number, number][] {
  return ring.map((coord) => projectPoint(coord[0]!, coord[1]!, width, height))
}

function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]
    const yi = ring[i]![1]
    const xj = ring[j]![0]
    const yj = ring[j]![1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function computeInteriorLabelPoint(
  geometry: PolygonGeometry,
  width: number,
  height: number,
): [number, number] {
  const rings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]!]
      : geometry.coordinates.map((polygon) => polygon[0]!)

  const outerRing = rings[0]
  if (!outerRing) return computeCentroid(geometry, width, height)

  const projected = projectRing(outerRing, width, height)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of projected) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const centroid = computeCentroid(geometry, width, height)
  if (pointInRing(centroid[0], centroid[1], projected)) {
    return centroid
  }

  const steps = 6
  let best: [number, number] | null = null
  let bestScore = -Infinity
  for (let row = 1; row < steps; row += 1) {
    for (let col = 1; col < steps; col += 1) {
      const x = minX + ((maxX - minX) * col) / steps
      const y = minY + ((maxY - minY) * row) / steps
      if (!pointInRing(x, y, projected)) continue
      const dx = x - (minX + maxX) / 2
      const dy = y - (minY + maxY) / 2
      const score = -(dx * dx + dy * dy)
      if (score > bestScore) {
        bestScore = score
        best = [x, y]
      }
    }
  }

  return best ?? centroid
}

const MAX_CACHE_ENTRIES = 500

export class GeometryCache {
  private unionCache = new Map<string, PolygonGeometry>()
  private pathCache = new Map<string, string>()
  private centroidCache = new Map<string, [number, number]>()
  private assignmentHash: string | null = null

  private trimCache<T>(cache: Map<string, T>): void {
    if (cache.size <= MAX_CACHE_ENTRIES) return
    const removeCount = cache.size - MAX_CACHE_ENTRIES
    const keys = [...cache.keys()].slice(0, removeCount)
    for (const key of keys) cache.delete(key)
  }

  setAssignmentHash(hash: string): void {
    if (this.assignmentHash === hash) return
    this.assignmentHash = hash
    this.unionCache.clear()
  }

  invalidate(): void {
    this.unionCache.clear()
    this.pathCache.clear()
    this.centroidCache.clear()
    this.assignmentHash = null
  }

  getDistrictGeometry(districtId: string): PolygonGeometry | null {
    return districtFeaturesById.get(districtId)?.geometry ?? null
  }

  getUnionGeometry(cacheKey: string, districtIds: string[]): PolygonGeometry | null {
    const cached = this.unionCache.get(cacheKey)
    if (cached) return cached

    const features = districtIds
      .map((districtId) => districtFeaturesById.get(districtId))
      .filter((item): item is DistrictFeature => Boolean(item))

    const merged = unionFeatures(features)
    if (!merged?.geometry) return null
    if (merged.geometry.type !== 'Polygon' && merged.geometry.type !== 'MultiPolygon') return null

    this.unionCache.set(cacheKey, merged.geometry)
    this.trimCache(this.unionCache)
    return merged.geometry
  }

  getSvgPath(pathKey: string, geometry: Geometry, width: number, height: number): string {
    const cacheKey = `${pathKey}:${width}x${height}`
    const cached = this.pathCache.get(cacheKey)
    if (cached) return cached

    const path = geometryToSvgPath(geometry, width, height)
    this.pathCache.set(cacheKey, path)
    this.trimCache(this.pathCache)
    return path
  }

  getCentroid(centroidKey: string, geometry: PolygonGeometry, width: number, height: number): [number, number] {
    const cacheKey = `${centroidKey}:${width}x${height}`
    const cached = this.centroidCache.get(cacheKey)
    if (cached) return cached

    const centroid = computeCentroid(geometry, width, height)
    this.centroidCache.set(cacheKey, centroid)
    this.trimCache(this.centroidCache)
    return centroid
  }

  getLabelAnchor(anchorKey: string, geometry: PolygonGeometry, width: number, height: number): [number, number] {
    const cacheKey = `${anchorKey}:${width}x${height}`
    const cached = this.centroidCache.get(cacheKey)
    if (cached) return cached

    const anchor = computeInteriorLabelPoint(geometry, width, height)
    this.centroidCache.set(cacheKey, anchor)
    this.trimCache(this.centroidCache)
    return anchor
  }
}

let sharedGeometryCache: GeometryCache | null = null

export function getGeometryCache(): GeometryCache {
  if (!sharedGeometryCache) {
    sharedGeometryCache = new GeometryCache()
  }
  return sharedGeometryCache
}

export function resetGeometryCache(): void {
  sharedGeometryCache?.invalidate()
}
