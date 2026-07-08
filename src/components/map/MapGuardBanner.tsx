import { canUseDataVisualization } from '../../domain/dataset/datasetValidation'
import { visualizationRegistry } from '../../domain/visualization/VisualizationRegistry'
import { useActiveDataset } from '../../store/datasetStore'
import { useMapState } from '../../store/mapStore'

export function MapGuardBanner() {
  const { pluginId, datasetId } = useMapState()
  const { dataset } = useActiveDataset(datasetId)
  const plugin = visualizationRegistry.getById(pluginId)

  if (!plugin?.requiresDataset) return null

  const canUse = canUseDataVisualization(pluginId, dataset?.status)

  if (canUse) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {!dataset
        ? 'Datová vizualizace vyžaduje připravený dataset. Vyberte dataset nebo importujte nový.'
        : `Dataset „${dataset.name}" není připraven (stav: ${dataset.status}). Dokončete import ve wizardu.`}
    </div>
  )
}
