import { createEmptyColorMap, getWorkplaceForDistrict } from '../contextUtils'
import {
  SUPERVISION_DIMMED_COLOR,
  SUPERVISION_DIMMED_OPACITY,
  SUPERVISION_UNPLANNED_COLOR,
  type SupervisionYearFilter,
} from '../../supervision-plan/types'
import { buildYearColorMap, getPlannedYear } from '../../supervision-plan/supervisionPlanSummary'
import type { VisualizationPlugin } from '../types'

export const supervisionPlanPlugin: VisualizationPlugin = {
  id: 'supervision-plan',
  name: 'Plán supervizí',
  description: 'Obarvení podle plánovaného roku supervize pracoviště',
  requiresDataset: false,
  requiresColumn: false,
  requiresOrganization: true,
  districtInteraction: false,
  supportsColumn: () => false,
  resolveColors: (context) => {
    const colors = createEmptyColorMap(context)
    const plan = context.supervisionPlan
    if (!plan) return colors

    const yearColors = buildYearColorMap(plan.years)
    const yearFilter = plan.yearFilter ?? 'all'
    const orgWorkplaces = context.organization?.workplaces ?? []

    for (const district of context.districts) {
      const workplaceId = getWorkplaceForDistrict(context, district.id)
      if (!workplaceId) continue

      const orgWorkplace = orgWorkplaces.find((wp) => wp.id === workplaceId)
      if (orgWorkplace?.absentFromSync) continue

      const plannedYear = getPlannedYear(plan, workplaceId)

      if (yearFilter === 'all') {
        if (plannedYear === null) {
          colors[district.id] = { fill: SUPERVISION_UNPLANNED_COLOR }
        } else {
          colors[district.id] = { fill: yearColors.get(plannedYear) ?? SUPERVISION_UNPLANNED_COLOR }
        }
        continue
      }

      if (yearFilter === 'unplanned') {
        if (plannedYear === null) {
          colors[district.id] = { fill: SUPERVISION_UNPLANNED_COLOR }
        } else {
          colors[district.id] = { fill: SUPERVISION_DIMMED_COLOR, opacity: SUPERVISION_DIMMED_OPACITY }
        }
        continue
      }

      if (plannedYear === yearFilter) {
        colors[district.id] = { fill: yearColors.get(yearFilter) ?? '#2563eb' }
      } else {
        colors[district.id] = { fill: SUPERVISION_DIMMED_COLOR, opacity: SUPERVISION_DIMMED_OPACITY }
      }
    }

    return colors
  },
  buildLegend: (context) => {
    const plan = context.supervisionPlan
    if (!plan) {
      return { title: 'Plán supervizí', items: [] }
    }

    const orgWorkplaces = context.organization?.workplaces ?? []
    const activeIds = orgWorkplaces.filter((wp) => !wp.absentFromSync).map((wp) => wp.id)
    const yearFilter = plan.yearFilter ?? 'all'

    const countByYear = new Map<number, number>()
    let unplanned = 0
    for (const workplaceId of activeIds) {
      const year = getPlannedYear(plan, workplaceId)
      if (year === null) {
        unplanned += 1
      } else {
        countByYear.set(year, (countByYear.get(year) ?? 0) + 1)
      }
    }

    const items = plan.years
      .filter((y) => y.isActive)
      .sort((a, b) => a.year - b.year)
      .map((y) => ({
        id: String(y.year),
        label: y.label ?? String(y.year),
        color: y.color,
        count: countByYear.get(y.year) ?? 0,
        subtitle: yearFilter === y.year ? 'Vybraný rok' : undefined,
      }))

    items.push({
      id: 'unplanned',
      label: 'Bez plánu',
      color: SUPERVISION_UNPLANNED_COLOR,
      count: unplanned,
      subtitle: yearFilter === 'unplanned' ? 'Vybraný filtr' : undefined,
    })

    if (typeof yearFilter === 'number') {
      for (const item of items) {
        if (item.id !== String(yearFilter) && item.id !== 'unplanned') {
          item.subtitle = 'Ostatní'
        }
      }
    }

    return {
      title: 'Plán supervizí',
      items,
    }
  },
}

export function resolveSupervisionYearFilterLabel(filter: SupervisionYearFilter): string {
  if (filter === 'all') return 'Všechny roky'
  if (filter === 'unplanned') return 'Bez plánu'
  return String(filter)
}
