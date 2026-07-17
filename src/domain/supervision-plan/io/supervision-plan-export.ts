import type { OrganizationSnapshot } from '../../organization/types'
import { hashString } from '../../visualization/colorUtils'
import type { SupervisionPlan } from '../types'
import { computeSupervisionPlanSummary } from '../supervisionPlanSummary'
import {
  assignmentsRecordToArray,
  SUPERVISION_PLAN_FILE_TYPE,
  SUPERVISION_PLAN_FORMAT_VERSION,
  type SupervisionPlanExportFile,
} from './supervision-plan-schema'

function slugify(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function buildOrganizationFingerprint(snapshot: OrganizationSnapshot): string {
  const ids = snapshot.workplaces
    .filter((wp) => !wp.absentFromSync)
    .map((wp) => wp.id)
    .sort()
    .join('|')
  return `${snapshot.syncedAt ?? 'unsynced'}:${ids.length}:${hashString(ids)}`
}

export function buildSupervisionPlanExportFile(
  plan: SupervisionPlan,
  snapshot: OrganizationSnapshot,
  appVersion = '0.0.0',
): SupervisionPlanExportFile {
  const activeWorkplaces = snapshot.workplaces.filter((wp) => !wp.absentFromSync)
  const summary = computeSupervisionPlanSummary(plan, activeWorkplaces)
  const activeYears = plan.years.filter((y) => y.isActive)
  const yearRange =
    activeYears.length > 0
      ? {
          from: activeYears[0]!.year,
          to: activeYears[activeYears.length - 1]!.year,
        }
      : undefined

  const workplaceNameById = new Map(activeWorkplaces.map((wp) => [wp.id, wp.name]))

  return {
    fileType: SUPERVISION_PLAN_FILE_TYPE,
    formatVersion: SUPERVISION_PLAN_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    plan: {
      name: plan.name,
      version: plan.version,
      updatedAt: plan.updatedAt,
      years: plan.years.map((year) => ({ ...year })),
      assignments: assignmentsRecordToArray(plan.assignments).map((assignment) => ({
        ...assignment,
        workplaceNameSnapshot: workplaceNameById.get(assignment.workplaceId),
      })),
    },
    metadata: {
      assignmentCount: Object.keys(plan.assignments).length,
      plannedCount: summary.plannedCount,
      unplannedCount: summary.unplannedCount,
      yearRange,
      sourceOrganizationFingerprint: buildOrganizationFingerprint(snapshot),
    },
  }
}

export function serializeSupervisionPlanExportFile(exportFile: SupervisionPlanExportFile): string {
  return JSON.stringify(exportFile, null, 2)
}

export function buildSupervisionPlanExportFilename(plan: SupervisionPlan, date = new Date()): string {
  const activeYears = plan.years.filter((y) => y.isActive).map((y) => y.year)
  const range =
    activeYears.length > 0
      ? `${activeYears[0]}-${activeYears[activeYears.length - 1]}`
      : 'bez-roku'
  const nameSlug = slugify(plan.name) || 'plan-supervizi'
  const datePart = date.toISOString().slice(0, 10)
  return `${nameSlug}-${range}-${datePart}.json`
}
