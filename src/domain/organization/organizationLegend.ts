import { resolveLeaderColor } from './leaderColors'
import type { OrganizationLegendLayout } from './organizationLegendLayout'
import { DEFAULT_ORGANIZATION_LEGEND_LAYOUT } from './organizationLegendLayout'
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
  /** @deprecated použij layout + computeAutoColumnCount */
  columnCount?: number
  layout: OrganizationLegendLayout
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
  columnCount: 1,
  layout: DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
}

export { DEFAULT_ORGANIZATION_LEGEND_LAYOUT, sanitizeOrganizationLegendLayout } from './organizationLegendLayout'

export function compareOrgUnitDesignations(a?: string, b?: string): number {
  const left = (a ?? '').trim()
  const right = (b ?? '').trim()
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  return left.localeCompare(right, 'cs', { numeric: true, sensitivity: 'base' })
}

export function distributeLegendItemsRowMajor<T>(items: T[], columnCount: number): T[][] {
  const columns = Math.max(1, Math.floor(columnCount))
  if (columns <= 1) return [items]

  const rows = Math.ceil(items.length / columns)
  const result: T[][] = Array.from({ length: columns }, () => [])
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col
      if (index < items.length) result[col].push(items[index])
    }
  }
  return result
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

  items.sort((a, b) => {
    const byDesignation = compareOrgUnitDesignations(a.orgUnitDesignation, b.orgUnitDesignation)
    if (byDesignation !== 0) return byDesignation
    const byLeader = a.leaderName.localeCompare(b.leaderName, 'cs')
    if (byLeader !== 0) return byLeader
    return a.leaderId.localeCompare(b.leaderId)
  })

  const limit = input.maxItems ?? items.length
  return items.slice(0, limit)
}
