import type { OrganizationSnapshot, OrganizationWorkplace } from './types'

export type AssignmentConflictField = 'regionId' | 'leaderId'
export type AssignmentConflictResolution = 'keep-local' | 'use-incoming'

export interface WorkplaceAssignmentConflict {
  workplaceId: string
  workplaceName: string
  field: AssignmentConflictField
  localValue: string
  incomingValue: string
  localLabel: string
  incomingLabel: string
}

function labelRegion(snapshot: OrganizationSnapshot, regionId: string): string {
  return snapshot.regions.find((region) => region.id === regionId)?.name ?? regionId
}

function labelLeader(snapshot: OrganizationSnapshot, leaderId: string): string {
  return snapshot.leaders.find((leader) => leader.id === leaderId)?.name ?? leaderId
}

function detectFieldConflict(
  current: OrganizationWorkplace,
  incoming: OrganizationWorkplace,
  field: AssignmentConflictField,
  currentSnapshot: OrganizationSnapshot,
  incomingSnapshot: OrganizationSnapshot,
): WorkplaceAssignmentConflict | null {
  const manualFlag = field === 'regionId' ? current.manualEdits?.regionId : current.manualEdits?.leaderId
  if (!manualFlag) return null

  const localValue = current[field]
  const incomingValue = incoming[field]
  if (!localValue || !incomingValue || localValue === incomingValue) return null

  const localLabel =
    field === 'regionId'
      ? labelRegion(currentSnapshot, localValue)
      : labelLeader(currentSnapshot, localValue)
  const incomingLabel =
    field === 'regionId'
      ? labelRegion(incomingSnapshot, incomingValue)
      : labelLeader(incomingSnapshot, incomingValue)

  return {
    workplaceId: current.id,
    workplaceName: current.name,
    field,
    localValue,
    incomingValue,
    localLabel,
    incomingLabel,
  }
}

export function detectWorkplaceAssignmentConflicts(
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
): WorkplaceAssignmentConflict[] {
  const conflicts: WorkplaceAssignmentConflict[] = []
  const incomingById = new Map(incoming.workplaces.map((wp) => [wp.id, wp]))

  for (const localWp of current.workplaces) {
    if (localWp.absentFromSync) continue
    const incomingWp = incomingById.get(localWp.id)
    if (!incomingWp) continue

    for (const field of ['regionId', 'leaderId'] as const) {
      const conflict = detectFieldConflict(localWp, incomingWp, field, current, incoming)
      if (conflict) conflicts.push(conflict)
    }
  }

  return conflicts
}

export function applyAssignmentConflictResolutions(
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
  resolutions: Record<string, AssignmentConflictResolution>,
): OrganizationWorkplace[] {
  return incoming.workplaces.map((incomingWp) => {
    const localWp = current.workplaces.find((wp) => wp.id === incomingWp.id)
    if (!localWp) return incomingWp

    let regionId = incomingWp.regionId
    let leaderId = incomingWp.leaderId
    let orgUnitId = incomingWp.orgUnitId
    let manualEdits = { ...incomingWp.manualEdits }

    const regionKey = `${incomingWp.id}:regionId`
    const leaderKey = `${incomingWp.id}:leaderId`
    const regionResolution = resolutions[regionKey]
    const leaderResolution = resolutions[leaderKey]

    if (regionResolution === 'keep-local' && localWp.manualEdits?.regionId) {
      regionId = localWp.regionId
      manualEdits = { ...manualEdits, regionId: true }
    } else if (regionResolution === 'use-incoming') {
      manualEdits = { ...manualEdits, regionId: false }
    }

    if (leaderResolution === 'keep-local' && localWp.manualEdits?.leaderId) {
      leaderId = localWp.leaderId
      orgUnitId = localWp.orgUnitId
      manualEdits = { ...manualEdits, leaderId: true }
    } else if (leaderResolution === 'use-incoming') {
      const leader = incoming.leaders.find((item) => item.id === leaderId)
      orgUnitId = leader?.orgUnitId ?? incomingWp.orgUnitId
      manualEdits = { ...manualEdits, leaderId: false }
    }

    const cleanedManualEdits =
      manualEdits.regionId || manualEdits.leaderId
        ? {
            ...(manualEdits.regionId ? { regionId: true } : {}),
            ...(manualEdits.leaderId ? { leaderId: true } : {}),
          }
        : undefined

    return {
      ...incomingWp,
      regionId,
      leaderId,
      orgUnitId,
      manualEdits: cleanedManualEdits,
    }
  })
}

export function defaultConflictResolutions(
  conflicts: WorkplaceAssignmentConflict[],
): Record<string, AssignmentConflictResolution> {
  const resolutions: Record<string, AssignmentConflictResolution> = {}
  for (const conflict of conflicts) {
    resolutions[`${conflict.workplaceId}:${conflict.field}`] = 'keep-local'
  }
  return resolutions
}
