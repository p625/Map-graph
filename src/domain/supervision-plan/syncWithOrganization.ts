import type { OrganizationWorkplace } from '../organization/types'
import type { SupervisionPlan } from './types'

export function syncSupervisionPlanWithOrganization(
  plan: SupervisionPlan,
  activeWorkplaces: OrganizationWorkplace[],
): SupervisionPlan {
  const activeIds = new Set(activeWorkplaces.map((wp) => wp.id))
  const assignments = { ...plan.assignments }
  let changed = false

  for (const workplaceId of Object.keys(assignments)) {
    if (!activeIds.has(workplaceId)) {
      delete assignments[workplaceId]
      changed = true
    }
  }

  if (!changed) return plan
  return {
    ...plan,
    assignments,
    updatedAt: new Date().toISOString(),
  }
}
