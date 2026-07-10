import { districts as seedDistricts } from '../../data/seed/districts'
import type {
  DistrictWorkplaceAssignments,
  WorkplaceRegionalAssignments,
} from '../types/assignment'
import type { District } from '../types/district'
import type { RegionalOffice } from '../types/regionalOffice'
import type { Workplace } from '../types/workplace'

export interface WorkplaceResolverInput {
  districts?: District[]
  workplaces: Workplace[]
  regionalOffices: RegionalOffice[]
  districtWorkplaceAssignments: DistrictWorkplaceAssignments
  workplaceRegionalAssignments: WorkplaceRegionalAssignments
}

/**
 * Centrální resolver vazeb okres → pracoviště → region.
 * Mapa používá pouze kanonická ID a názvy — aliasy a historické názvy řeší synchronizace.
 */
export class WorkplaceResolver {
  readonly districts: District[]
  readonly workplaces: Workplace[]
  readonly regionalOffices: RegionalOffice[]

  private readonly districtById = new Map<string, District>()
  private readonly workplaceById = new Map<string, Workplace>()
  private readonly regionById = new Map<string, RegionalOffice>()
  private readonly districtsByWorkplace = new Map<string, string[]>()
  private readonly districtsByRegion = new Map<string, string[]>()
  private readonly workplacesByRegion = new Map<string, string[]>()

  constructor(input: WorkplaceResolverInput) {
    this.districts = input.districts ?? seedDistricts
    this.workplaces = input.workplaces
    this.regionalOffices = input.regionalOffices

    for (const district of this.districts) {
      this.districtById.set(district.id, district)
    }
    for (const workplace of this.workplaces) {
      this.workplaceById.set(workplace.id, workplace)
    }
    for (const region of this.regionalOffices) {
      this.regionById.set(region.id, region)
    }

    for (const district of this.districts) {
      const workplaceId = input.districtWorkplaceAssignments[district.id]
      if (!workplaceId) continue
      const list = this.districtsByWorkplace.get(workplaceId) ?? []
      list.push(district.id)
      this.districtsByWorkplace.set(workplaceId, list)

      const regionId = input.workplaceRegionalAssignments[workplaceId]
      if (!regionId) continue

      const regionDistricts = this.districtsByRegion.get(regionId) ?? []
      regionDistricts.push(district.id)
      this.districtsByRegion.set(regionId, regionDistricts)

      const regionWorkplaces = this.workplacesByRegion.get(regionId) ?? []
      if (!regionWorkplaces.includes(workplaceId)) {
        regionWorkplaces.push(workplaceId)
        this.workplacesByRegion.set(regionId, regionWorkplaces)
      }
    }
  }

  getDistrict(districtId: string): District | null {
    return this.districtById.get(districtId) ?? null
  }

  getWorkplace(workplaceId: string): Workplace | null {
    return this.workplaceById.get(workplaceId) ?? null
  }

  getRegion(regionId: string): RegionalOffice | null {
    return this.regionById.get(regionId) ?? null
  }

  getWorkplaceIdForDistrict(districtId: string): string | null {
    for (const [workplaceId, districtIds] of this.districtsByWorkplace) {
      if (districtIds.includes(districtId)) return workplaceId
    }
    return null
  }

  getWorkplaceForDistrict(districtId: string): Workplace | null {
    const workplaceId = this.getWorkplaceIdForDistrict(districtId)
    return workplaceId ? this.getWorkplace(workplaceId) : null
  }

  getDistrictsForWorkplace(workplaceId: string): District[] {
    return (this.districtsByWorkplace.get(workplaceId) ?? [])
      .map((id) => this.getDistrict(id))
      .filter((item): item is District => Boolean(item))
  }

  getRegionIdForWorkplace(workplaceId: string): string | null {
    for (const [regionId, workplaceIds] of this.workplacesByRegion) {
      if (workplaceIds.includes(workplaceId)) return regionId
    }
    return null
  }

  getRegionForWorkplace(workplaceId: string): RegionalOffice | null {
    const regionId = this.getRegionIdForWorkplace(workplaceId)
    return regionId ? this.getRegion(regionId) : null
  }

  getDistrictsForRegion(regionId: string): District[] {
    return (this.districtsByRegion.get(regionId) ?? [])
      .map((id) => this.getDistrict(id))
      .filter((item): item is District => Boolean(item))
  }

  getWorkplacesForRegion(regionId: string): Workplace[] {
    return (this.workplacesByRegion.get(regionId) ?? [])
      .map((id) => this.getWorkplace(id))
      .filter((item): item is Workplace => Boolean(item))
  }

  getDisplayName(workplaceId: string): string {
    return this.getWorkplace(workplaceId)?.name ?? workplaceId
  }

  getDistrictIdsForWorkplace(workplaceId: string): string[] {
    return [...(this.districtsByWorkplace.get(workplaceId) ?? [])]
  }

  getDistrictIdsForRegion(regionId: string): string[] {
    return [...(this.districtsByRegion.get(regionId) ?? [])]
  }
}

export function createWorkplaceResolver(input: WorkplaceResolverInput): WorkplaceResolver {
  return new WorkplaceResolver(input)
}

export function hashAssignmentState(
  districtWorkplaceAssignments: DistrictWorkplaceAssignments,
  workplaceRegionalAssignments: WorkplaceRegionalAssignments,
): string {
  const districtPairs = Object.entries(districtWorkplaceAssignments).sort(([a], [b]) => a.localeCompare(b))
  const regionalPairs = Object.entries(workplaceRegionalAssignments).sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify({ districtPairs, regionalPairs })
}
