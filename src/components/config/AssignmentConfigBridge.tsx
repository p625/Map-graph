import { useEffect, useRef } from 'react'
import { isOrganizationSynced } from '../../domain/organization/organizationState'
import { snapshotToConfigAssignments } from '../../domain/organization/organizationSync'
import { clearRegionViewportCache } from '../../domain/region/regionViewport'
import { useConfigDispatch } from '../../store/configStore'
import { useOrganizationSnapshot } from '../../store/organizationStore'

/**
 * Synchronizuje odvozené district + regional assignments z organization snapshot do configStore.
 * Org snapshot je zdroj pravdy po synchronizaci z organizace.xlsx.
 */
export function AssignmentConfigBridge() {
  const snapshot = useOrganizationSnapshot()
  const configDispatch = useConfigDispatch()
  const prevAssignmentsHashRef = useRef('')

  useEffect(() => {
    if (!isOrganizationSynced(snapshot)) return

    const assignments = snapshotToConfigAssignments(snapshot)
    const hash = JSON.stringify(assignments)
    if (hash === prevAssignmentsHashRef.current) return
    prevAssignmentsHashRef.current = hash

    configDispatch({
      type: 'sync-derived-organization-assignments',
      districtWorkplaceAssignments: assignments.districtWorkplaceAssignments,
      workplaceRegionalAssignments: assignments.workplaceRegionalAssignments,
    })
    clearRegionViewportCache()
  }, [snapshot, configDispatch])

  return null
}
