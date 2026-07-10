import { useMemo } from 'react'
import {
  buildOrganizationLegendItems,
  type OrganizationLegendItem,
  type OrganizationLegendSettings,
} from '../domain/organization/organizationLegend'
import { isOrganizationSynced, useOrganizationSnapshot } from '../store/organizationStore'
import { useRegionScope } from './useRegionScope'

export function useOrganizationLegendItems(
  settings: OrganizationLegendSettings,
): OrganizationLegendItem[] {
  const snapshot = useOrganizationSnapshot()
  const regionScope = useRegionScope()
  const synced = isOrganizationSynced(snapshot)

  return useMemo(() => {
    if (!settings.enabled || !synced) return []
    return buildOrganizationLegendItems({
      leaders: snapshot.leaders,
      orgUnits: snapshot.orgUnits,
      workplaces: snapshot.workplaces,
      regionScope,
      maxItems: settings.maxItems,
    })
  }, [settings.enabled, settings.maxItems, snapshot, synced, regionScope])
}
