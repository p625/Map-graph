import type { OrganizationWorkplace } from '../organization/types'
import type { SupervisionPlan, SupervisionPlanYearConfig } from './types'

export interface SupervisionPlanSummary {
  totalWorkplaces: number
  plannedCount: number
  unplannedCount: number
  byYear: Array<{ year: number; count: number; color: string; label: string }>
  unplanned: { count: number; color: string }
}

export function getPlannedYear(
  plan: SupervisionPlan,
  workplaceId: string,
): number | null {
  return plan.assignments[workplaceId]?.plannedYear ?? null
}

export function buildWorkplaceYearMap(plan: SupervisionPlan): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const [workplaceId, assignment] of Object.entries(plan.assignments)) {
    map.set(workplaceId, assignment.plannedYear)
  }
  return map
}

export function buildYearColorMap(years: SupervisionPlanYearConfig[]): Map<number, string> {
  return new Map(years.filter((y) => y.isActive).map((y) => [y.year, y.color]))
}

export function computeSupervisionPlanSummary(
  plan: SupervisionPlan,
  activeWorkplaces: OrganizationWorkplace[],
): SupervisionPlanSummary {
  const activeIds = activeWorkplaces.map((wp) => wp.id)
  const byYearMap = new Map<number, number>()
  for (const year of plan.years.filter((y) => y.isActive)) {
    byYearMap.set(year.year, 0)
  }

  let plannedCount = 0
  for (const workplaceId of activeIds) {
    const year = getPlannedYear(plan, workplaceId)
    if (year === null) continue
    plannedCount += 1
    byYearMap.set(year, (byYearMap.get(year) ?? 0) + 1)
  }

  const totalWorkplaces = activeIds.length
  const unplannedCount = totalWorkplaces - plannedCount

  return {
    totalWorkplaces,
    plannedCount,
    unplannedCount,
    byYear: plan.years
      .filter((y) => y.isActive)
      .sort((a, b) => a.year - b.year)
      .map((y) => ({
        year: y.year,
        count: byYearMap.get(y.year) ?? 0,
        color: y.color,
        label: y.label ?? String(y.year),
      })),
    unplanned: { count: unplannedCount, color: '#cbd5e1' },
  }
}
