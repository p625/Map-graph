export type DistrictId = string
export type WorkplaceId = string
export type RegionalOfficeId = string

export interface DistrictWorkplaceAssignment {
  districtId: DistrictId
  workplaceId: WorkplaceId
}

export interface WorkplaceRegionalAssignment {
  workplaceId: WorkplaceId
  regionalOfficeId: RegionalOfficeId
}

export type DistrictWorkplaceAssignments = Record<DistrictId, WorkplaceId>
export type WorkplaceRegionalAssignments = Record<WorkplaceId, RegionalOfficeId>
