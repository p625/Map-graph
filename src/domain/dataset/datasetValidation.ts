import type { DatasetStatus } from '../types/dataset'
import type { ImportPreview } from '../import/ImportPipeline'

export function resolveStatusFromPreview(preview: ImportPreview): DatasetStatus {
  if (preview.records.length === 0) return 'imported'
  if (preview.unmatchedCount > 0) return 'matched'
  return 'validated'
}

export function resolveReadyStatus(
  matchedCount: number,
  recordCount: number,
  dataColumnCount: number,
): DatasetStatus {
  if (recordCount === 0 || dataColumnCount === 0) return 'imported'
  if (matchedCount < recordCount) return 'matched'
  return 'ready'
}

export function migrateDatasetStatus(status: string): DatasetStatus {
  if (status === 'partial') return 'matched'
  if (status === 'ready') return 'ready'
  if (status === 'draft') return 'draft'
  if (status === 'imported') return 'imported'
  if (status === 'matched') return 'matched'
  if (status === 'validated') return 'validated'
  return 'imported'
}

export const DATA_VISUALIZATION_PLUGINS = ['choropleth', 'categorical'] as const

export const ORGANIZATION_PLUGINS = ['by-leader'] as const

export function isDataVisualizationPlugin(pluginId: string): boolean {
  return (DATA_VISUALIZATION_PLUGINS as readonly string[]).includes(pluginId)
}

export function requiresOrganizationSync(pluginId: string): boolean {
  return (ORGANIZATION_PLUGINS as readonly string[]).includes(pluginId)
}

export function canUseOrganizationVisualization(
  pluginId: string,
  organizationSynced: boolean,
): boolean {
  if (!requiresOrganizationSync(pluginId)) return true
  return organizationSynced
}

export function canUseDataVisualization(
  pluginId: string,
  datasetStatus: DatasetStatus | undefined,
): boolean {
  if (!isDataVisualizationPlugin(pluginId)) return true
  return datasetStatus === 'ready'
}

export function datasetStatusLabel(status: DatasetStatus): string {
  switch (status) {
    case 'draft':
      return 'Koncept'
    case 'imported':
      return 'Importováno'
    case 'matched':
      return 'Spárováno (s chybami)'
    case 'validated':
      return 'Validováno'
    case 'ready':
      return 'Připraveno'
  }
}
