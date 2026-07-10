import { resolveLeaderColor } from '../../organization/leaderColors'
import type { VisualizationPlugin } from '../types'
import { createEmptyColorMap, getWorkplaceForDistrict } from '../contextUtils'

export const byLeaderPlugin: VisualizationPlugin = {
  id: 'by-leader',
  name: 'Podle vedoucích',
  description: 'Obarvení podle vedoucího pracoviště OPŽL',
  requiresDataset: false,
  requiresColumn: false,
  requiresOrganization: true,
  districtInteraction: false,
  supportsColumn: () => false,
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const org = context.organization
    if (!org) return colors

    const leaderById = new Map(org.leaders.map((leader, index) => [leader.id, { leader, index }]))
    const workplaceById = new Map(org.workplaces.map((wp) => [wp.id, wp]))

    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue

      const orgWorkplace = workplaceById.get(workplaceId)
      if (!orgWorkplace?.leaderId) continue

      const leaderEntry = leaderById.get(orgWorkplace.leaderId)
      colors[district.id] = {
        fill: resolveLeaderColor(leaderEntry?.leader, leaderEntry?.index ?? 0),
      }
    }

    return colors
  },
  buildLegend: (context) => {
    const org = context.organization
    if (!org) {
      return { title: 'Vedoucí', items: [] }
    }

    const workplaceCountByLeader = new Map<string, number>()
    for (const wp of org.workplaces) {
      if (wp.absentFromSync || !wp.leaderId) continue
      workplaceCountByLeader.set(wp.leaderId, (workplaceCountByLeader.get(wp.leaderId) ?? 0) + 1)
    }

    const orgUnitById = new Map(org.orgUnits.map((unit) => [unit.id, unit]))

    return {
      title: 'Vedoucí',
      items: org.leaders
        .map((leader, index) => {
          const orgUnit = orgUnitById.get(leader.orgUnitId)
          return {
            id: leader.id,
            label: leader.name,
            subtitle: orgUnit?.designation,
            color: resolveLeaderColor(leader, index),
            count: workplaceCountByLeader.get(leader.id),
          }
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
    }
  },
}
