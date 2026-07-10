import type { OrganizationSnapshot } from '../../domain/organization/types'
import { detectWorkplaceAssignmentConflicts } from '../../domain/organization/assignmentConflicts'

export interface WorkplaceAssignmentFilters {
  search: string
  regionId: string
  leaderId: string
  onlyConflicts: boolean
  onlyAbsent: boolean
}

export const defaultWorkplaceFilters: WorkplaceAssignmentFilters = {
  search: '',
  regionId: '',
  leaderId: '',
  onlyConflicts: false,
  onlyAbsent: false,
}

export function countDistrictsByWorkplace(snapshot: OrganizationSnapshot): Map<string, number> {
  const counts = new Map<string, number>()
  for (const assignment of snapshot.districtAssignments) {
    counts.set(assignment.workplaceId, (counts.get(assignment.workplaceId) ?? 0) + 1)
  }
  return counts
}

export function workplaceHasManualConflict(
  snapshot: OrganizationSnapshot,
  workplaceId: string,
  incoming?: OrganizationSnapshot,
): boolean {
  if (!incoming) {
    const wp = snapshot.workplaces.find((item) => item.id === workplaceId)
    return Boolean(wp?.manualEdits?.regionId || wp?.manualEdits?.leaderId)
  }
  const conflicts = detectWorkplaceAssignmentConflicts(snapshot, incoming)
  return conflicts.some((conflict) => conflict.workplaceId === workplaceId)
}

export function filterWorkplaces(
  snapshot: OrganizationSnapshot,
  filters: WorkplaceAssignmentFilters,
  options: { includeAbsent?: boolean; incoming?: OrganizationSnapshot } = {},
) {
  const search = filters.search.trim().toLowerCase()
  const districtCounts = countDistrictsByWorkplace(snapshot)

  return snapshot.workplaces.filter((workplace) => {
    if (!options.includeAbsent && workplace.absentFromSync && !filters.onlyAbsent) return false
    if (filters.onlyAbsent && !workplace.absentFromSync) return false
    if (filters.regionId && workplace.regionId !== filters.regionId) return false
    if (filters.leaderId && workplace.leaderId !== filters.leaderId) return false
    if (filters.onlyConflicts && !workplaceHasManualConflict(snapshot, workplace.id, options.incoming)) {
      return false
    }
    if (search && !workplace.name.toLowerCase().includes(search)) return false
    return true
  }).map((workplace) => ({
    workplace,
    districtCount: districtCounts.get(workplace.id) ?? 0,
  }))
}
