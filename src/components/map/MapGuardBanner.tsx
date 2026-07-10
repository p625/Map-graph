import {
  canUseDataVisualization,
  canUseOrganizationVisualization,
  requiresOrganizationSync,
} from '../../domain/dataset/datasetValidation'
import { visualizationRegistry } from '../../domain/visualization/VisualizationRegistry'
import { useActiveDataset } from '../../store/datasetStore'
import { useConfigData } from '../../store/configStore'
import { isOrganizationSynced } from '../../store/organizationStore'
import { useMapState } from '../../store/mapStore'

export function MapGuardBanner() {
  const { pluginId, datasetId } = useMapState()
  const { dataset } = useActiveDataset(datasetId)
  const { organizationSnapshot } = useConfigData()
  const plugin = visualizationRegistry.getById(pluginId)
  const orgSynced = isOrganizationSynced(organizationSnapshot)

  if (!plugin) return null

  if (plugin.requiresDataset) {
    const canUse = canUseDataVisualization(pluginId, dataset?.status)
    if (!canUse) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {!dataset
            ? 'Datová vizualizace vyžaduje připravený dataset. Vyberte dataset nebo importujte nový.'
            : `Dataset „${dataset.name}" není připraven (stav: ${dataset.status}). Dokončete import ve wizardu.`}
        </div>
      )
    }
  }

  if (requiresOrganizationSync(pluginId) && !canUseOrganizationVisualization(pluginId, orgSynced)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Režim „{plugin.name}" vyžaduje synchronizovanou organizaci. Nejprve importujte{' '}
        <code className="rounded bg-amber-100 px-1">organizace.xlsx</code> v sekci Synchronizace
        organizace.
      </div>
    )
  }

  return null
}
