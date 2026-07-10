import type { OrganizationSnapshot, OrganizationWorkplace } from './types'

export interface AssignmentValidationError {
  workplaceId: string
  field: 'regionId' | 'leaderId' | 'orgUnitId'
  message: string
}

export function isActiveWorkplace(workplace: OrganizationWorkplace): boolean {
  return !workplace.absentFromSync
}

export function validateWorkplaceRegionChange(
  snapshot: OrganizationSnapshot,
  workplaceId: string,
  regionId: string,
): AssignmentValidationError | null {
  const workplace = snapshot.workplaces.find((wp) => wp.id === workplaceId)
  if (!workplace) {
    return { workplaceId, field: 'regionId', message: 'Pracoviště neexistuje.' }
  }
  if (workplace.absentFromSync) {
    return {
      workplaceId,
      field: 'regionId',
      message: 'Pracoviště chybí ve synchronizaci — region nelze měnit.',
    }
  }
  if (!regionId) {
    return { workplaceId, field: 'regionId', message: 'Region musí být vybrán.' }
  }
  if (!snapshot.regions.some((region) => region.id === regionId)) {
    return { workplaceId, field: 'regionId', message: 'Vybraný region neexistuje.' }
  }
  return null
}

export function validateWorkplaceLeaderChange(
  snapshot: OrganizationSnapshot,
  workplaceId: string,
  leaderId: string,
): AssignmentValidationError | null {
  const workplace = snapshot.workplaces.find((wp) => wp.id === workplaceId)
  if (!workplace) {
    return { workplaceId, field: 'leaderId', message: 'Pracoviště neexistuje.' }
  }
  if (workplace.absentFromSync) {
    return {
      workplaceId,
      field: 'leaderId',
      message: 'Pracoviště chybí ve synchronizaci — vedoucího nelze měnit.',
    }
  }
  if (!leaderId) {
    return { workplaceId, field: 'leaderId', message: 'Vedoucí musí být vybrán.' }
  }
  const leader = snapshot.leaders.find((item) => item.id === leaderId)
  if (!leader) {
    return { workplaceId, field: 'leaderId', message: 'Vybraný vedoucí neexistuje.' }
  }
  return null
}

export function validateActiveWorkplaceAssignments(
  snapshot: OrganizationSnapshot,
): AssignmentValidationError[] {
  const errors: AssignmentValidationError[] = []
  for (const workplace of snapshot.workplaces) {
    if (!isActiveWorkplace(workplace)) continue
    if (!workplace.regionId) {
      errors.push({
        workplaceId: workplace.id,
        field: 'regionId',
        message: `${workplace.name}: chybí region.`,
      })
    } else if (!snapshot.regions.some((region) => region.id === workplace.regionId)) {
      errors.push({
        workplaceId: workplace.id,
        field: 'regionId',
        message: `${workplace.name}: neplatný region.`,
      })
    }
    if (!workplace.leaderId) {
      errors.push({
        workplaceId: workplace.id,
        field: 'leaderId',
        message: `${workplace.name}: chybí vedoucí.`,
      })
    } else {
      const leader = snapshot.leaders.find((item) => item.id === workplace.leaderId)
      if (!leader) {
        errors.push({
          workplaceId: workplace.id,
          field: 'leaderId',
          message: `${workplace.name}: neplatný vedoucí.`,
        })
      } else if (workplace.orgUnitId !== leader.orgUnitId) {
        errors.push({
          workplaceId: workplace.id,
          field: 'orgUnitId',
          message: `${workplace.name}: orgUnitId neodpovídá vedoucímu.`,
        })
      }
    }
  }
  return errors
}

export function conflictResolutionKey(workplaceId: string, field: 'regionId' | 'leaderId'): string {
  return `${workplaceId}:${field}`
}
