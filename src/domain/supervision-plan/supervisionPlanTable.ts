import type { OrganizationSnapshot } from '../organization/types'
import type { SupervisionPlanTableFilters } from './types'
import { getPlannedYear } from './supervisionPlanSummary'
import type { SupervisionPlan } from './types'

export const defaultSupervisionPlanFilters: SupervisionPlanTableFilters = {
  search: '',
  regionId: '',
  leaderId: '',
  orgUnitId: '',
  plannedYear: '',
}

export interface SupervisionPlanTableRow {
  workplaceId: string
  workplaceName: string
  leaderName: string
  orgUnitLabel: string
  regionName: string
  plannedYear: number | null
  note: string
}

export function buildSupervisionPlanTableRows(
  snapshot: OrganizationSnapshot,
  plan: SupervisionPlan,
): SupervisionPlanTableRow[] {
  const leaderById = new Map(snapshot.leaders.map((l) => [l.id, l]))
  const regionById = new Map(snapshot.regions.map((r) => [r.id, r]))
  const orgUnitById = new Map(snapshot.orgUnits.map((u) => [u.id, u]))

  return snapshot.workplaces
    .filter((wp) => !wp.absentFromSync)
    .map((workplace) => {
      const leader = workplace.leaderId ? leaderById.get(workplace.leaderId) : undefined
      const region = workplace.regionId ? regionById.get(workplace.regionId) : undefined
      const orgUnit = workplace.orgUnitId ? orgUnitById.get(workplace.orgUnitId) : undefined
      return {
        workplaceId: workplace.id,
        workplaceName: workplace.name,
        leaderName: leader?.name ?? '—',
        orgUnitLabel: orgUnit ? `${orgUnit.designation} · ${orgUnit.name}` : '—',
        regionName: region?.name ?? '—',
        plannedYear: getPlannedYear(plan, workplace.id),
        note: plan.assignments[workplace.id]?.note ?? '',
      }
    })
}

export function filterSupervisionPlanTableRows(
  rows: SupervisionPlanTableRow[],
  filters: SupervisionPlanTableFilters,
  snapshot: OrganizationSnapshot,
): SupervisionPlanTableRow[] {
  const search = filters.search.trim().toLowerCase()
  const workplaceById = new Map(snapshot.workplaces.map((wp) => [wp.id, wp]))

  return rows.filter((row) => {
    const workplace = workplaceById.get(row.workplaceId)
    if (!workplace) return false
    if (filters.regionId && workplace.regionId !== filters.regionId) return false
    if (filters.leaderId && workplace.leaderId !== filters.leaderId) return false
    if (filters.orgUnitId && workplace.orgUnitId !== filters.orgUnitId) return false
    if (search && !row.workplaceName.toLowerCase().includes(search)) return false
    if (filters.plannedYear === 'unplanned' && row.plannedYear !== null) return false
    if (typeof filters.plannedYear === 'number' && row.plannedYear !== filters.plannedYear) return false
    return true
  })
}

export type SupervisionPlanSortKey =
  | 'workplace'
  | 'leader'
  | 'region'
  | 'plannedYear'

export function sortSupervisionPlanRows(
  rows: SupervisionPlanTableRow[],
  sortKey: SupervisionPlanSortKey,
  direction: 'asc' | 'desc',
): SupervisionPlanTableRow[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'workplace':
        cmp = a.workplaceName.localeCompare(b.workplaceName, 'cs')
        break
      case 'leader':
        cmp = a.leaderName.localeCompare(b.leaderName, 'cs')
        break
      case 'region':
        cmp = a.regionName.localeCompare(b.regionName, 'cs')
        break
      case 'plannedYear': {
        const av = a.plannedYear ?? 9999
        const bv = b.plannedYear ?? 9999
        cmp = av - bv
        break
      }
    }
    return cmp * factor
  })
}
