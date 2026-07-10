import type { GeometryCache } from './geometryCache'
import { getGeometryCache } from './geometryCache'
import type {
  BoundaryPath,
  BoundaryVisibility,
  TerritoryLayers,
  TerritoryPolygon,
} from './types'
import type { WorkplaceResolver } from './workplaceResolver'

export interface TerritoryEngineInput {
  resolver: WorkplaceResolver
  width: number
  height: number
  boundaryVisibility: BoundaryVisibility
  assignmentHash: string
  geometryCache?: GeometryCache
}

export function buildTerritoryLayers(input: TerritoryEngineInput): TerritoryLayers {
  const cache = input.geometryCache ?? getGeometryCache()
  cache.setAssignmentHash(input.assignmentHash)
  const { resolver, width, height, boundaryVisibility, assignmentHash } = input

  const fillPolygons: TerritoryPolygon[] = []
  const districtBoundaries: BoundaryPath[] = []
  const workplaceBoundaries: BoundaryPath[] = []
  const regionBoundaries: BoundaryPath[] = []

  for (const district of resolver.districts) {
    const geometry = cache.getDistrictGeometry(district.id)
    if (!geometry) continue

    const pathKey = `district:${district.id}`
    const svgPath = cache.getSvgPath(pathKey, geometry, width, height)
    const centroid = cache.getCentroid(pathKey, geometry, width, height)

    fillPolygons.push({
      id: `district-${district.id}`,
      level: 'district',
      entityId: district.id,
      districtIds: [district.id],
      svgPath,
      centroid,
    })

    if (boundaryVisibility.district) {
      districtBoundaries.push({
        id: `district-boundary-${district.id}`,
        level: 'district',
        entityId: district.id,
        svgPath,
      })
    }
  }

  if (boundaryVisibility.workplace) {
    for (const workplace of resolver.workplaces) {
      const districtIds = resolver.getDistrictIdsForWorkplace(workplace.id)
      if (districtIds.length === 0) continue

      const unionKey = `workplace:${assignmentHash}:${workplace.id}`
      const geometry = cache.getUnionGeometry(unionKey, districtIds)
      if (!geometry) continue

      workplaceBoundaries.push({
        id: `workplace-boundary-${workplace.id}`,
        level: 'workplace',
        entityId: workplace.id,
        svgPath: cache.getSvgPath(`boundary:${unionKey}`, geometry, width, height),
      })
    }
  }

  if (boundaryVisibility.region) {
    for (const region of resolver.regionalOffices) {
      const districtIds = resolver.getDistrictIdsForRegion(region.id)
      if (districtIds.length === 0) continue

      const unionKey = `region:${assignmentHash}:${region.id}`
      const geometry = cache.getUnionGeometry(unionKey, districtIds)
      if (!geometry) continue

      regionBoundaries.push({
        id: `region-boundary-${region.id}`,
        level: 'region',
        entityId: region.id,
        svgPath: cache.getSvgPath(`boundary:${unionKey}`, geometry, width, height),
      })
    }
  }

  return {
    fillPolygons,
    boundaries: {
      district: districtBoundaries,
      workplace: workplaceBoundaries,
      region: regionBoundaries,
    },
  }
}
