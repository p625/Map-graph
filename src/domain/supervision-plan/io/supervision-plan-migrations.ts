import type { SupervisionPlanExportFile } from './supervision-plan-schema'
import {
  SUPPORTED_SUPERVISION_PLAN_FORMAT_VERSIONS,
  SUPERVISION_PLAN_FILE_TYPE,
  SUPERVISION_PLAN_FORMAT_VERSION,
} from './supervision-plan-schema'

export function migrateSupervisionPlanImportFile(raw: unknown): SupervisionPlanExportFile | null {
  if (!raw || typeof raw !== 'object') return null
  const file = raw as Partial<SupervisionPlanExportFile>
  if (file.fileType !== SUPERVISION_PLAN_FILE_TYPE) return null
  if (file.formatVersion !== SUPERVISION_PLAN_FORMAT_VERSION) return null
  return file as SupervisionPlanExportFile
}

export function isSupportedFormatVersion(version: number): boolean {
  return (SUPPORTED_SUPERVISION_PLAN_FORMAT_VERSIONS as readonly number[]).includes(version)
}
