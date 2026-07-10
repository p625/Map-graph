import type { OrganizationSnapshot } from './types'

/** Organizace je synchronizovaná, pokud obsahuje kompletní vazby (ne jen syncedAt). */
export function isOrganizationSynced(snapshot: OrganizationSnapshot): boolean {
  if (snapshot.regions.length === 0 || snapshot.leaders.length === 0) {
    return false
  }

  const activeWorkplaces = snapshot.workplaces.filter((wp) => !wp.absentFromSync)
  if (activeWorkplaces.length === 0) {
    return false
  }

  return activeWorkplaces.every(
    (wp) => Boolean(wp.regionId && wp.leaderId && wp.orgUnitId),
  )
}

export function isEmptyOrganizationSeed(snapshot: OrganizationSnapshot): boolean {
  return (
    !snapshot.syncedAt &&
    snapshot.regions.length === 0 &&
    snapshot.leaders.length === 0 &&
    snapshot.orgUnits.length === 0 &&
    snapshot.districtAssignments.length === 0
  )
}

export function normalizePersistedOrganization(
  snapshot: OrganizationSnapshot,
): OrganizationSnapshot {
  if (!isOrganizationSynced(snapshot)) {
    return snapshot
  }

  return {
    ...snapshot,
    syncedAt: snapshot.syncedAt ?? new Date().toISOString(),
  }
}
