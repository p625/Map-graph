import { resolveLeaderColor } from './leaderColors'
import type { Leader, OrgUnit, OrganizationWorkplace } from './types'
import { isRegionFocused } from '../region/regionScope'
import type { RegionScope } from '../region/types'

export type OrganizationLegendLabelMode =
  | 'leader'
  | 'org-unit'
  | 'leader-org-unit'
  | 'none'

export interface OrganizationLegendSettings {
  enabled: boolean
  labelMode: OrganizationLegendLabelMode
  position: 'top-right'
  showWorkplaceCount: boolean
  maxItems?: number
}

export interface OrganizationLegendItem {
  leaderId: string
  color: string
  leaderName: string
  orgUnitDesignation: string
  workplaceCount: number
}

export const DEFAULT_ORGANIZATION_LEGEND_SETTINGS: OrganizationLegendSettings = {
  enabled: false,
  labelMode: 'leader-org-unit',
  position: 'top-right',
  showWorkplaceCount: false,
}

export function formatOrganizationLegendLabel(
  item: OrganizationLegendItem,
  mode: OrganizationLegendLabelMode,
  showWorkplaceCount: boolean,
): string {
  let text = ''
  switch (mode) {
    case 'leader':
      text = item.leaderName
      break
    case 'org-unit':
      text = item.orgUnitDesignation
      break
    case 'leader-org-unit':
      text = item.orgUnitDesignation
        ? `${item.leaderName} — ${item.orgUnitDesignation}`
        : item.leaderName
      break
    case 'none':
      text = ''
      break
  }
  if (showWorkplaceCount && text) {
    text = `${text} (${item.workplaceCount})`
  } else if (showWorkplaceCount && !text) {
    text = `(${item.workplaceCount})`
  }
  return text
}

export function buildOrganizationLegendItems(input: {
  leaders: Leader[]
  orgUnits: OrgUnit[]
  workplaces: OrganizationWorkplace[]
  regionScope?: RegionScope
  maxItems?: number
}): OrganizationLegendItem[] {
  const orgUnitById = new Map(input.orgUnits.map((unit) => [unit.id, unit]))
  const activeWorkplaces = input.workplaces.filter((workplace) => !workplace.absentFromSync)
  const focused = input.regionScope && isRegionFocused(input.regionScope)

  const items: OrganizationLegendItem[] = []

  input.leaders.forEach((leader, index) => {
    const scopedWorkplaces = focused
      ? activeWorkplaces.filter(
          (workplace) =>
            workplace.leaderId === leader.id &&
            workplace.regionId === input.regionScope!.regionId,
        )
      : activeWorkplaces.filter((workplace) => workplace.leaderId === leader.id)

    if (scopedWorkplaces.length === 0) return

    const orgUnit = orgUnitById.get(leader.orgUnitId)
    items.push({
      leaderId: leader.id,
      color: resolveLeaderColor(leader, index),
      leaderName: leader.name,
      orgUnitDesignation: orgUnit?.designation ?? '',
      workplaceCount: scopedWorkplaces.length,
    })
  })

  items.sort((a, b) => a.leaderName.localeCompare(b.leaderName, 'cs'))

  const limit = input.maxItems ?? items.length
  return items.slice(0, limit)
}
