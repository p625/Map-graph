import type {
  SupervisionPlanAssignment,
  SupervisionPlanYearConfig,
} from '../types'

export const SUPERVISION_PLAN_FILE_TYPE = 'map-graph-supervision-plan' as const
export const SUPERVISION_PLAN_FORMAT_VERSION = 1
export const SUPPORTED_SUPERVISION_PLAN_FORMAT_VERSIONS = [1] as const

export const MAX_SUPERVISION_PLAN_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_SUPERVISION_PLAN_NAME_LENGTH = 200
export const MAX_SUPERVISION_PLAN_NOTE_LENGTH = 500
export const MAX_SUPERVISION_PLAN_ASSIGNMENTS = 500

export interface SupervisionPlanExportAssignment {
  workplaceId: string
  plannedYear: number | null
  note?: string
  updatedAt?: string
  workplaceNameSnapshot?: string
}

export interface SupervisionPlanExportFile {
  fileType: typeof SUPERVISION_PLAN_FILE_TYPE
  formatVersion: number
  exportedAt: string
  appVersion?: string
  plan: {
    id?: string
    name: string
    version: number
    updatedAt: string
    years: SupervisionPlanYearConfig[]
    assignments: SupervisionPlanExportAssignment[]
  }
  metadata: {
    assignmentCount: number
    plannedCount: number
    unplannedCount: number
    yearRange?: { from: number; to: number }
    sourceOrganizationFingerprint?: string
  }
}

export type SupervisionPlanImportMode = 'replace' | 'merge'

export interface SupervisionPlanImportValidationError {
  code: string
  message: string
}

export interface SupervisionPlanImportPreview {
  file: SupervisionPlanExportFile
  planName: string
  exportedAt: string
  yearCount: number
  assignmentCount: number
  plannedCount: number
  unplannedInImport: number
  matchingWorkplaceIds: string[]
  unknownWorkplaceIds: Array<{ workplaceId: string; workplaceNameSnapshot?: string }>
  missingInImportWorkplaceIds: string[]
  yearsToAdd: number[]
  yearsToUpdate: Array<{ year: number; colorChanged: boolean; labelChanged: boolean }>
  importableAssignmentCount: number
}

export interface SupervisionPlanImportApplyReport {
  mode: SupervisionPlanImportMode
  importedAssignmentCount: number
  ignoredUnknownWorkplaceIds: string[]
  clearedWorkplaceIds: string[]
  preservedWorkplaceIds: string[]
}

export function assignmentsRecordToArray(
  assignments: Record<string, SupervisionPlanAssignment>,
): SupervisionPlanExportAssignment[] {
  return Object.values(assignments)
    .map((assignment) => ({
      workplaceId: assignment.workplaceId,
      plannedYear: assignment.plannedYear,
      note: assignment.note,
      updatedAt: assignment.updatedAt,
    }))
    .sort((a, b) => a.workplaceId.localeCompare(b.workplaceId))
}

export function assignmentsArrayToRecord(
  assignments: SupervisionPlanExportAssignment[],
): Record<string, SupervisionPlanAssignment> {
  const record: Record<string, SupervisionPlanAssignment> = {}
  for (const item of assignments) {
    record[item.workplaceId] = {
      workplaceId: item.workplaceId,
      plannedYear: item.plannedYear,
      note: item.note,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    }
  }
  return record
}
