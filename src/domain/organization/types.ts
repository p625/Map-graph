export interface Region {
  id: string
  name: string
  code: string
}

export interface OrgUnit {
  id: string
  designation: string
  name: string
}

export interface Leader {
  id: string
  name: string
  orgUnitId: string
  color: string
}

export interface OrganizationWorkplace {
  id: string
  name: string
  code?: string
  regionId: string
  leaderId: string
  orgUnitId: string
  lpisName?: string
  /** Pracoviště v lokálních datech, ale chybí ve synchronizačním souboru */
  absentFromSync?: boolean
  /** Označení ruční úpravy vazby (pro detekci konfliktů při sync) */
  manualEdits?: {
    regionId?: boolean
    leaderId?: boolean
  }
}

export interface DistrictAssignmentAudit {
  districtId: string
  workplaceId: string
  rawOkresName: string
  lpisName: string
}

export interface OrganizationSnapshot {
  regions: Region[]
  orgUnits: OrgUnit[]
  leaders: Leader[]
  workplaces: OrganizationWorkplace[]
  districtAssignments: DistrictAssignmentAudit[]
  syncedAt?: string
  sourceFileName?: string
}

export interface ParsedOrgRow {
  rawOkresName: string
  lpisName: string
  workplaceName: string
  leaderName: string
  orgUnitDesignation: string
  regionName: string
  resolvedDistrictId: string | null
  districtAliasUsed?: string
}
