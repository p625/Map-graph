import { isValidMapColor, normalizeHexColor } from '../../color/mapColorValidation'
import { sanitizeSupervisionPlan } from '../supervisionPlanSanitize'
import type { SupervisionPlan, SupervisionPlanYearConfig, SupervisionYearFilter } from '../types'
import { isSupportedFormatVersion } from './supervision-plan-migrations'
import {
  assignmentsArrayToRecord,
  MAX_SUPERVISION_PLAN_ASSIGNMENTS,
  MAX_SUPERVISION_PLAN_IMPORT_BYTES,
  MAX_SUPERVISION_PLAN_NAME_LENGTH,
  MAX_SUPERVISION_PLAN_NOTE_LENGTH,
  SUPERVISION_PLAN_FILE_TYPE,
  type SupervisionPlanExportAssignment,
  type SupervisionPlanExportFile,
  type SupervisionPlanImportApplyReport,
  type SupervisionPlanImportMode,
  type SupervisionPlanImportPreview,
  type SupervisionPlanImportValidationError,
} from './supervision-plan-schema'

export interface SupervisionPlanImportParseResult {
  ok: boolean
  data?: SupervisionPlanExportFile
  errors: SupervisionPlanImportValidationError[]
}

function error(code: string, message: string): SupervisionPlanImportValidationError {
  return { code, message }
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().slice(0, maxLength)
  return trimmed.length > 0 ? trimmed : undefined
}

function validateYear(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const year = Math.round(value)
  if (year < 2000 || year > 2100) return null
  return year
}

function validateYearConfig(
  value: unknown,
  index: number,
  errors: SupervisionPlanImportValidationError[],
): SupervisionPlanYearConfig | null {
  if (!value || typeof value !== 'object') {
    errors.push(error('invalid-year', `Rok na pozici ${index + 1} není validní objekt.`))
    return null
  }
  const raw = value as Partial<SupervisionPlanYearConfig>
  const year = validateYear(raw.year)
  if (year === null) {
    errors.push(error('invalid-year-value', `Rok na pozici ${index + 1} má neplatnou hodnotu.`))
    return null
  }
  if (typeof raw.color !== 'string' || !isValidMapColor(raw.color)) {
    errors.push(error('invalid-year-color', `Rok ${year} má neplatnou barvu.`))
    return null
  }
  if (raw.isActive !== undefined && typeof raw.isActive !== 'boolean') {
    errors.push(error('invalid-year-active', `Rok ${year} má neplatný příznak isActive.`))
    return null
  }
  return {
    year,
    color: normalizeHexColor(raw.color)!,
    label: sanitizeText(raw.label, 80),
    isActive: raw.isActive !== false,
  }
}

function validateAssignment(
  value: unknown,
  index: number,
  validYears: Set<number>,
  seenWorkplaceIds: Set<string>,
  errors: SupervisionPlanImportValidationError[],
): SupervisionPlanExportAssignment | null {
  if (!value || typeof value !== 'object') {
    errors.push(error('invalid-assignment', `Přiřazení na pozici ${index + 1} není validní objekt.`))
    return null
  }
  const raw = value as Partial<SupervisionPlanExportAssignment>
  if (typeof raw.workplaceId !== 'string' || raw.workplaceId.trim().length === 0) {
    errors.push(error('missing-workplace-id', `Přiřazení na pozici ${index + 1} nemá workplaceId.`))
    return null
  }
  const workplaceId = raw.workplaceId.trim()
  if (seenWorkplaceIds.has(workplaceId)) {
    errors.push(error('duplicate-workplace-id', `Pracoviště ${workplaceId} je v souboru uvedeno vícekrát.`))
    return null
  }
  seenWorkplaceIds.add(workplaceId)

  let plannedYear: number | null = null
  if (raw.plannedYear !== null && raw.plannedYear !== undefined) {
    const year = validateYear(raw.plannedYear)
    if (year === null) {
      errors.push(error('invalid-planned-year', `Pracoviště ${workplaceId} má neplatný plánovaný rok.`))
      return null
    }
    if (!validYears.has(year)) {
      errors.push(
        error(
          'unknown-planned-year',
          `Pracoviště ${workplaceId} odkazuje na rok ${year}, který v konfiguraci chybí.`,
        ),
      )
      return null
    }
    plannedYear = year
  }

  return {
    workplaceId,
    plannedYear,
    note: sanitizeText(raw.note, MAX_SUPERVISION_PLAN_NOTE_LENGTH),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    workplaceNameSnapshot: sanitizeText(raw.workplaceNameSnapshot, 120),
  }
}

export function parseSupervisionPlanImportJson(text: string): SupervisionPlanImportParseResult {
  if (text.length > MAX_SUPERVISION_PLAN_IMPORT_BYTES) {
    return {
      ok: false,
      errors: [error('file-too-large', 'Soubor je větší než povolených 5 MB.')],
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: [error('invalid-json', 'Soubor není validní JSON.')] }
  }

  return validateSupervisionPlanImportFile(parsed)
}

export function validateSupervisionPlanImportFile(raw: unknown): SupervisionPlanImportParseResult {
  const errors: SupervisionPlanImportValidationError[] = []
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [error('invalid-root', 'Kořenový objekt souboru není validní.')] }
  }

  const file = raw as Partial<SupervisionPlanExportFile>
  if (file.fileType !== SUPERVISION_PLAN_FILE_TYPE) {
    errors.push(
      error(
        'invalid-file-type',
        `Neplatný typ souboru${file.fileType ? `: ${String(file.fileType)}` : ''}. Očekáván map-graph-supervision-plan.`,
      ),
    )
  }
  if (typeof file.formatVersion !== 'number') {
    errors.push(error('missing-format-version', 'Chybí formatVersion.'))
  } else if (!isSupportedFormatVersion(file.formatVersion)) {
    errors.push(
      error(
        'unsupported-format-version',
        `Nepodporovaná verze formátu: ${file.formatVersion}.`,
      ),
    )
  }
  if (typeof file.exportedAt !== 'string') {
    errors.push(error('missing-exported-at', 'Chybí datum exportu exportedAt.'))
  }
  if (!file.plan || typeof file.plan !== 'object') {
    errors.push(error('missing-plan', 'Chybí sekce plan.'))
    return { ok: false, errors }
  }

  const planRaw = file.plan as Partial<SupervisionPlanExportFile['plan']>
  const name = sanitizeText(planRaw.name, MAX_SUPERVISION_PLAN_NAME_LENGTH)
  if (!name) {
    errors.push(error('missing-plan-name', 'Chybí název plánu.'))
  }

  if (!Array.isArray(planRaw.years) || planRaw.years.length === 0) {
    errors.push(error('missing-years', 'Plán musí obsahovat alespoň jeden rok.'))
  }

  const years: SupervisionPlanYearConfig[] = []
  const yearSet = new Set<number>()
  if (Array.isArray(planRaw.years)) {
    for (let index = 0; index < planRaw.years.length; index += 1) {
      const yearConfig = validateYearConfig(planRaw.years[index], index, errors)
      if (!yearConfig) continue
      if (yearSet.has(yearConfig.year)) {
        errors.push(error('duplicate-year', `Rok ${yearConfig.year} je v konfiguraci duplicitní.`))
        continue
      }
      yearSet.add(yearConfig.year)
      years.push(yearConfig)
    }
  }

  const validYears = new Set(years.filter((y) => y.isActive).map((y) => y.year))
  const assignments: SupervisionPlanExportAssignment[] = []
  const seenWorkplaceIds = new Set<string>()

  if (planRaw.assignments !== undefined && !Array.isArray(planRaw.assignments)) {
    errors.push(error('invalid-assignments', 'assignments musí být pole.'))
  } else if (Array.isArray(planRaw.assignments)) {
    if (planRaw.assignments.length > MAX_SUPERVISION_PLAN_ASSIGNMENTS) {
      errors.push(
        error(
          'too-many-assignments',
          `Soubor obsahuje příliš mnoho přiřazení (max. ${MAX_SUPERVISION_PLAN_ASSIGNMENTS}).`,
        ),
      )
    }
    for (let index = 0; index < planRaw.assignments.length; index += 1) {
      const assignment = validateAssignment(
        planRaw.assignments[index],
        index,
        validYears,
        seenWorkplaceIds,
        errors,
      )
      if (assignment) assignments.push(assignment)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const normalized: SupervisionPlanExportFile = {
    fileType: SUPERVISION_PLAN_FILE_TYPE,
    formatVersion: file.formatVersion!,
    exportedAt: file.exportedAt!,
    appVersion: typeof file.appVersion === 'string' ? file.appVersion : undefined,
    plan: {
      name: name!,
      version: typeof planRaw.version === 'number' ? planRaw.version : 1,
      updatedAt: typeof planRaw.updatedAt === 'string' ? planRaw.updatedAt : file.exportedAt!,
      years,
      assignments,
    },
    metadata:
      file.metadata && typeof file.metadata === 'object'
        ? (file.metadata as SupervisionPlanExportFile['metadata'])
        : {
            assignmentCount: assignments.length,
            plannedCount: assignments.filter((a) => a.plannedYear !== null).length,
            unplannedCount: assignments.filter((a) => a.plannedYear === null).length,
          },
  }

  return { ok: true, data: normalized, errors: [] }
}

export function buildSupervisionPlanImportPreview(
  file: SupervisionPlanExportFile,
  currentPlan: SupervisionPlan,
  activeWorkplaceIds: string[],
): SupervisionPlanImportPreview {
  const activeSet = new Set(activeWorkplaceIds)
  const importIds = new Set(file.plan.assignments.map((a) => a.workplaceId))

  const matchingWorkplaceIds = file.plan.assignments
    .map((a) => a.workplaceId)
    .filter((id) => activeSet.has(id))

  const unknownWorkplaceIds = file.plan.assignments
    .filter((a) => !activeSet.has(a.workplaceId))
    .map((a) => ({
      workplaceId: a.workplaceId,
      workplaceNameSnapshot: a.workplaceNameSnapshot,
    }))

  const missingInImportWorkplaceIds = activeWorkplaceIds.filter((id) => !importIds.has(id))

  const currentYearMap = new Map(currentPlan.years.map((y) => [y.year, y]))
  const yearsToAdd: number[] = []
  const yearsToUpdate: SupervisionPlanImportPreview['yearsToUpdate'] = []

  for (const importedYear of file.plan.years) {
    const existing = currentYearMap.get(importedYear.year)
    if (!existing) {
      yearsToAdd.push(importedYear.year)
      continue
    }
    const colorChanged = existing.color !== importedYear.color
    const labelChanged = (existing.label ?? '') !== (importedYear.label ?? '')
    if (colorChanged || labelChanged) {
      yearsToUpdate.push({ year: importedYear.year, colorChanged, labelChanged })
    }
  }

  const importableAssignmentCount = matchingWorkplaceIds.length
  const plannedCount = file.plan.assignments.filter(
    (a) => a.plannedYear !== null && activeSet.has(a.workplaceId),
  ).length
  const unplannedInImport = importableAssignmentCount - plannedCount

  return {
    file,
    planName: file.plan.name,
    exportedAt: file.exportedAt,
    yearCount: file.plan.years.length,
    assignmentCount: file.plan.assignments.length,
    plannedCount,
    unplannedInImport,
    matchingWorkplaceIds,
    unknownWorkplaceIds,
    missingInImportWorkplaceIds,
    yearsToAdd,
    yearsToUpdate,
    importableAssignmentCount,
  }
}

function filterImportAssignments(
  file: SupervisionPlanExportFile,
  activeWorkplaceIds: Set<string>,
): SupervisionPlanExportAssignment[] {
  return file.plan.assignments.filter((assignment) => activeWorkplaceIds.has(assignment.workplaceId))
}

export function applySupervisionPlanImport(
  mode: SupervisionPlanImportMode,
  currentPlan: SupervisionPlan,
  file: SupervisionPlanExportFile,
  activeWorkplaceIds: string[],
): { plan: SupervisionPlan; report: SupervisionPlanImportApplyReport } {
  const activeSet = new Set(activeWorkplaceIds)
  const importable = filterImportAssignments(file, activeSet)
  const ignoredUnknownWorkplaceIds = file.plan.assignments
    .filter((a) => !activeSet.has(a.workplaceId))
    .map((a) => a.workplaceId)

  if (mode === 'replace') {
    const assignments = assignmentsArrayToRecord(importable)
    const clearedWorkplaceIds = activeWorkplaceIds.filter(
      (id) => !importable.some((item) => item.workplaceId === id),
    )
    const plan = sanitizeSupervisionPlan({
      version: currentPlan.version,
      name: file.plan.name,
      years: file.plan.years,
      assignments,
      updatedAt: new Date().toISOString(),
    })
    return {
      plan,
      report: {
        mode,
        importedAssignmentCount: importable.length,
        ignoredUnknownWorkplaceIds,
        clearedWorkplaceIds,
        preservedWorkplaceIds: [],
      },
    }
  }

  const mergedYearsMap = new Map(currentPlan.years.map((y) => [y.year, y]))
  for (const importedYear of file.plan.years) {
    mergedYearsMap.set(importedYear.year, importedYear)
  }

  const mergedAssignments = { ...currentPlan.assignments }
  const preservedWorkplaceIds: string[] = []
  for (const assignment of importable) {
    mergedAssignments[assignment.workplaceId] = {
      workplaceId: assignment.workplaceId,
      plannedYear: assignment.plannedYear,
      note: assignment.note,
      updatedAt: assignment.updatedAt ?? new Date().toISOString(),
    }
  }
  for (const workplaceId of activeWorkplaceIds) {
    if (!importable.some((item) => item.workplaceId === workplaceId) && mergedAssignments[workplaceId]) {
      preservedWorkplaceIds.push(workplaceId)
    }
  }

  const plan = sanitizeSupervisionPlan({
    version: currentPlan.version,
    name: file.plan.name || currentPlan.name,
    years: [...mergedYearsMap.values()].sort((a, b) => a.year - b.year),
    assignments: mergedAssignments,
    updatedAt: new Date().toISOString(),
  })

  return {
    plan,
    report: {
      mode,
      importedAssignmentCount: importable.length,
      ignoredUnknownWorkplaceIds,
      clearedWorkplaceIds: [],
      preservedWorkplaceIds,
    },
  }
}

export function reconcileSupervisionYearFilterAfterImport(
  currentFilter: SupervisionYearFilter,
  importedPlan: SupervisionPlan,
): { filter: SupervisionYearFilter; resetReason?: string } {
  if (currentFilter === 'all' || currentFilter === 'unplanned') {
    return { filter: currentFilter }
  }
  const activeYears = new Set(importedPlan.years.filter((y) => y.isActive).map((y) => y.year))
  if (activeYears.has(currentFilter)) {
    return { filter: currentFilter }
  }
  return {
    filter: 'all',
    resetReason: `Filtr roku ${currentFilter} už v importovaném plánu není — přepnuto na Všechny roky.`,
  }
}

export function plansAreEqual(a: SupervisionPlan, b: SupervisionPlan): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
