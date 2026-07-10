import type { BoundaryPath, BoundaryVisibility, TerritoryFillMap, TerritoryLayers } from '../territory/types'
import { DEFAULT_STROKE } from '../visualization/colorUtils'
import type { DistrictColorMap, DistrictStyle } from '../visualization/types'

export interface ColorEngineInput {
  districtColors: DistrictColorMap
  territories: TerritoryLayers
  boundaryVisibility: BoundaryVisibility
  strokeColor?: string
  /** Každý okres má vlastní barvu — vždy vykreslit hranice mezi okresy. */
  separateDistrictStrokes?: boolean
}

export interface BoundaryStrokeStyle {
  stroke: string
  strokeWidth: number
}

const BOUNDARY_STROKES: Record<'district' | 'workplace' | 'region', BoundaryStrokeStyle> = {
  district: { stroke: '#94a3b8', strokeWidth: 0.6 },
  workplace: { stroke: '#334155', strokeWidth: 1.2 },
  region: { stroke: '#0f172a', strokeWidth: 1.8 },
}

export function resolveTerritoryFillStyles(
  input: ColorEngineInput,
  getWorkplaceId?: (districtId: string) => string | null,
): TerritoryFillMap {
  const { districtColors, territories, boundaryVisibility, strokeColor, separateDistrictStrokes } =
    input
  const fallbackStroke = strokeColor ?? DEFAULT_STROKE
  const styles: TerritoryFillMap = {}

  for (const polygon of territories.fillPolygons) {
    const districtStyle: DistrictStyle = districtColors[polygon.entityId] ?? { fill: '#f8fafc' }
    const fill = districtStyle.fill
    const workplaceId = getWorkplaceId?.(polygon.entityId) ?? null
    const hideInternalStroke =
      !separateDistrictStrokes && !boundaryVisibility.district && Boolean(workplaceId)

    styles[polygon.id] = {
      fill,
      opacity: districtStyle.opacity,
      stroke: hideInternalStroke ? fill : (districtStyle.stroke ?? fallbackStroke),
      strokeWidth: hideInternalStroke ? 0.2 : 0.6,
    }
  }

  return styles
}

export function resolveBoundaryStroke(level: 'district' | 'workplace' | 'region'): BoundaryStrokeStyle {
  return BOUNDARY_STROKES[level]
}

export type StyledBoundaryPath = BoundaryPath & BoundaryStrokeStyle

export interface LayeredBoundaryStrokes {
  district: StyledBoundaryPath[]
  workplace: StyledBoundaryPath[]
  region: StyledBoundaryPath[]
}

export function resolveLayeredBoundaryStrokes(territories: TerritoryLayers): LayeredBoundaryStrokes {
  return {
    district: territories.boundaries.district.map((path) => ({
      ...path,
      ...resolveBoundaryStroke('district'),
    })),
    workplace: territories.boundaries.workplace.map((path) => ({
      ...path,
      ...resolveBoundaryStroke('workplace'),
    })),
    region: territories.boundaries.region.map((path) => ({
      ...path,
      ...resolveBoundaryStroke('region'),
    })),
  }
}

export function resolveBoundaryStrokes(territories: TerritoryLayers): StyledBoundaryPath[] {
  const layered = resolveLayeredBoundaryStrokes(territories)
  return [...layered.district, ...layered.workplace, ...layered.region]
}
