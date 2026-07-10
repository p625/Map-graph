import type { DistrictStyle } from '../visualization/types'

export type TerritoryLevel = 'district' | 'workplace' | 'region'

export interface TerritoryPolygon {
  id: string
  level: TerritoryLevel
  entityId: string
  districtIds: string[]
  svgPath: string
  centroid: [number, number]
}

export interface BoundaryPath {
  id: string
  level: TerritoryLevel
  entityId: string
  svgPath: string
}

export interface BoundaryVisibility {
  district: boolean
  workplace: boolean
  region: boolean
}

export interface TerritoryLayers {
  fillPolygons: TerritoryPolygon[]
  boundaries: {
    district: BoundaryPath[]
    workplace: BoundaryPath[]
    region: BoundaryPath[]
  }
}

export interface TerritoryFillStyle extends DistrictStyle {
  strokeWidth: number
}

export type TerritoryFillMap = Record<string, TerritoryFillStyle>
