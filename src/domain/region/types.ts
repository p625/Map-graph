export type RegionViewMode = 'overview' | 'focused'

export type ExportMapScope = 'country' | 'focused-region'

export interface RegionScope {
  mode: RegionViewMode
  regionId: string | null
  regionName: string | null
  districtIds: ReadonlySet<string>
  workplaceIds: ReadonlySet<string>
}

export interface SvgViewport {
  x: number
  y: number
  width: number
  height: number
  viewBox: string
}
