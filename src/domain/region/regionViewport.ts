import type { Polygon, MultiPolygon, Position } from 'geojson'
import { getGeometryCache } from '../territory/geometryCache'
import { projectPoint } from '../../utils/districtGeometries'
import type { SvgViewport } from './types'

const viewportCache = new Map<string, SvgViewport>()

function collectPositions(geometry: Polygon | MultiPolygon): Position[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat()
  }
  return geometry.coordinates.flat(2)
}

function computeBoundingBox(
  districtIds: string[],
  canvasWidth: number,
  canvasHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const cache = getGeometryCache()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let hasPoint = false

  for (const districtId of districtIds) {
    const geometry = cache.getDistrictGeometry(districtId)
    if (!geometry) continue

    for (const coord of collectPositions(geometry)) {
      const [x, y] = projectPoint(coord[0]!, coord[1]!, canvasWidth, canvasHeight)
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      hasPoint = true
    }
  }

  if (!hasPoint || !Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export function getRegionViewport(
  regionId: string,
  districtIds: string[],
  canvasWidth: number,
  canvasHeight: number,
  assignmentHash: string,
  paddingRatio = 0.04,
): SvgViewport | null {
  const cacheKey = `${assignmentHash}:${regionId}:${canvasWidth}x${canvasHeight}:${paddingRatio}`
  const cached = viewportCache.get(cacheKey)
  if (cached) return cached

  const bbox = computeBoundingBox(districtIds, canvasWidth, canvasHeight)
  if (!bbox) return null

  const rawWidth = Math.max(1, bbox.maxX - bbox.minX)
  const rawHeight = Math.max(1, bbox.maxY - bbox.minY)
  const padX = rawWidth * paddingRatio
  const padY = rawHeight * paddingRatio

  const x = Math.max(0, bbox.minX - padX)
  const y = Math.max(0, bbox.minY - padY)
  const width = Math.min(canvasWidth - x, rawWidth + padX * 2)
  const height = Math.min(canvasHeight - y, rawHeight + padY * 2)

  const viewport: SvgViewport = {
    x,
    y,
    width,
    height,
    viewBox: `${x} ${y} ${width} ${height}`,
  }

  viewportCache.set(cacheKey, viewport)
  if (viewportCache.size > 200) {
    const firstKey = viewportCache.keys().next().value
    if (firstKey) viewportCache.delete(firstKey)
  }

  return viewport
}

export function clearRegionViewportCache(): void {
  viewportCache.clear()
}
