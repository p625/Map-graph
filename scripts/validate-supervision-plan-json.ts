/**
 * Validace JSON exportu a importu plánu supervizí (Phase 5D.1).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import {
  buildSupervisionPlanExportFile,
  buildSupervisionPlanExportFilename,
  serializeSupervisionPlanExportFile,
} from '../src/domain/supervision-plan/io/supervision-plan-export.ts'
import {
  applySupervisionPlanImport,
  buildSupervisionPlanImportPreview,
  parseSupervisionPlanImportJson,
  plansAreEqual,
  reconcileSupervisionYearFilterAfterImport,
  validateSupervisionPlanImportFile,
} from '../src/domain/supervision-plan/io/supervision-plan-import.ts'
import {
  MAX_SUPERVISION_PLAN_IMPORT_BYTES,
  SUPERVISION_PLAN_FILE_TYPE,
  SUPERVISION_PLAN_FORMAT_VERSION,
} from '../src/domain/supervision-plan/io/supervision-plan-schema.ts'
import { createDefaultSupervisionPlan } from '../src/domain/supervision-plan/supervisionPlanDefaults.ts'
import { sanitizeSupervisionPlan } from '../src/domain/supervision-plan/supervisionPlanSanitize.ts'
import { getPlannedYear } from '../src/domain/supervision-plan/supervisionPlanSummary.ts'
import { SUPERVISION_PLAN_STORAGE_KEY } from '../src/domain/supervision-plan/types.ts'
import { supervisionPlanPlugin } from '../src/domain/visualization/plugins/supervisionPlanPlugin.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function assignmentSnapshot(plan: ReturnType<typeof sanitizeSupervisionPlan>) {
  return JSON.stringify({
    years: plan.years,
    assignments: plan.assignments,
    name: plan.name,
  })
}

async function main() {
  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)

  const activeWorkplaces = merged.workplaces
    .filter((workplace) => !workplace.absentFromSync)
    .map((workplace) => {
      const seedWp = seedWorkplaces.find((item) => item.id === workplace.id)
      return { id: workplace.id, code: seedWp?.code ?? workplace.id, name: workplace.name }
    })
  const activeIds = activeWorkplaces.map((wp) => wp.id)
  const wp1 = activeWorkplaces[0]!
  const wp2 = activeWorkplaces[1]!
  const wp3 = activeWorkplaces[2]!
  const year2026 = 2026
  const year2027 = 2027
  const customColor = '#ff00aa'
  const noteText = 'Poznámka k supervizi'

  const sourcePlan = sanitizeSupervisionPlan({
    ...createDefaultSupervisionPlan(year2026),
    assignments: {
      [wp1.id]: {
        workplaceId: wp1.id,
        plannedYear: year2026,
        note: noteText,
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      [wp2.id]: {
        workplaceId: wp2.id,
        plannedYear: year2027,
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
    },
    years: createDefaultSupervisionPlan(year2026).years.map((y) =>
      y.year === year2026 ? { ...y, color: customColor } : y,
    ),
  })

  const exportFile = buildSupervisionPlanExportFile(sourcePlan, merged, '0.0.0-test')
  const json = serializeSupervisionPlanExportFile(exportFile)

  check('export-file-type', exportFile.fileType === SUPERVISION_PLAN_FILE_TYPE, exportFile.fileType)
  check(
    'export-format-version',
    exportFile.formatVersion === SUPERVISION_PLAN_FORMAT_VERSION,
    String(exportFile.formatVersion),
  )
  check('export-plan-name', exportFile.plan.name.length > 0, exportFile.plan.name)
  check('export-years', exportFile.plan.years.length >= 4, `${exportFile.plan.years.length} years`)
  check(
    'export-assignments-array',
    Array.isArray(exportFile.plan.assignments) && exportFile.plan.assignments.length >= 2,
    `${exportFile.plan.assignments.length} assignments`,
  )
  check(
    'export-color-preserved',
    exportFile.plan.years.find((y) => y.year === year2026)?.color === customColor,
    exportFile.plan.years.find((y) => y.year === year2026)?.color ?? '',
  )
  check(
    'export-note-preserved',
    exportFile.plan.assignments.find((a) => a.workplaceId === wp1.id)?.note === noteText,
    exportFile.plan.assignments.find((a) => a.workplaceId === wp1.id)?.note ?? '',
  )
  check('export-json-valid', (() => { try { JSON.parse(json); return true } catch { return false } })(), `${json.length} bytes`)

  const filename = buildSupervisionPlanExportFilename(sourcePlan, new Date('2026-07-17'))
  check(
    'export-filename-safe',
    filename.endsWith('.json') && !filename.includes('/') && !filename.includes('\\'),
    filename,
  )

  const parsed = parseSupervisionPlanImportJson(json)
  check('import-parse-valid-export', parsed.ok && Boolean(parsed.data), parsed.errors.map((e) => e.message).join('; '))

  if (parsed.data) {
    const importPreview = buildSupervisionPlanImportPreview(parsed.data, createDefaultSupervisionPlan(year2026), activeIds)
    check(
      'preview-matching-workplaces',
      importPreview.matchingWorkplaceIds.length >= 2,
      `${importPreview.matchingWorkplaceIds.length}`,
    )
    check(
      'preview-unknown-workplaces-reported',
      importPreview.unknownWorkplaceIds.length === 0,
      `${importPreview.unknownWorkplaceIds.length}`,
    )

    const { plan: replacedPlan } = applySupervisionPlanImport('replace', createDefaultSupervisionPlan(year2026), parsed.data, activeIds)
    check(
      'round-trip-replace-assignments',
      getPlannedYear(replacedPlan, wp1.id) === year2026 && getPlannedYear(replacedPlan, wp2.id) === year2027,
      `${getPlannedYear(replacedPlan, wp1.id)}, ${getPlannedYear(replacedPlan, wp2.id)}`,
    )
    check(
      'round-trip-replace-colors',
      replacedPlan.years.find((y) => y.year === year2026)?.color === customColor,
      replacedPlan.years.find((y) => y.year === year2026)?.color ?? '',
    )
    check(
      'round-trip-replace-notes',
      replacedPlan.assignments[wp1.id]?.note === noteText,
      replacedPlan.assignments[wp1.id]?.note ?? '',
    )
    check(
      'round-trip-equality',
      assignmentSnapshot(replacedPlan) === assignmentSnapshot(sourcePlan),
      'assignment+year snapshot match',
    )

    const memory = new Map<string, string>()
    memory.set(SUPERVISION_PLAN_STORAGE_KEY, JSON.stringify(replacedPlan))
    const reloaded = sanitizeSupervisionPlan(JSON.parse(memory.get(SUPERVISION_PLAN_STORAGE_KEY)!))
    check(
      'persistence-after-import',
      plansAreEqual(replacedPlan, reloaded),
      'storage round-trip',
    )

    const districtAssignments: Record<string, string> = {}
    for (const assignment of merged.districtAssignments) {
      districtAssignments[assignment.districtId] = assignment.workplaceId
    }
    const regionalAssignments: Record<string, string> = {}
    for (const workplace of merged.workplaces) {
      if (!workplace.absentFromSync && workplace.regionId) {
        regionalAssignments[workplace.id] = workplace.regionId
      }
    }
    const mapContext: VisualizationContext = {
      districts,
      workplaces: activeWorkplaces,
      regionalOffices: [],
      districtWorkplaceAssignments: districtAssignments,
      workplaceRegionalAssignments: regionalAssignments,
      organization: {
        leaders: merged.leaders,
        orgUnits: merged.orgUnits,
        workplaces: merged.workplaces.filter((wp) => !wp.absentFromSync),
      },
      theme: classicTheme,
      supervisionPlan: { ...reloaded, yearFilter: 'all' },
    }
    const colors = supervisionPlanPlugin.resolveColors(mapContext)
    const wp1District = Object.entries(districtAssignments).find(([, id]) => id === wp1.id)?.[0]
    check(
      'map-refresh-after-import',
      Boolean(wp1District && colors[wp1District]?.fill === customColor),
      wp1District ? colors[wp1District]?.fill : 'no district',
    )

    const { filter, resetReason } = reconcileSupervisionYearFilterAfterImport(2030, replacedPlan)
    check('year-filter-reset', filter === 'all' && Boolean(resetReason), `${filter} ${resetReason ?? ''}`)

    const modifiedPlan = sanitizeSupervisionPlan({
      ...sourcePlan,
      assignments: {
        ...sourcePlan.assignments,
        [wp3.id]: { workplaceId: wp3.id, plannedYear: year2026, updatedAt: new Date().toISOString() },
      },
    })
    const { plan: mergedPlan, report: mergeReport } = applySupervisionPlanImport(
      'merge',
      modifiedPlan,
      parsed.data,
      activeIds,
    )
    check(
      'merge-overwrites-imported',
      getPlannedYear(mergedPlan, wp1.id) === year2026,
      String(getPlannedYear(mergedPlan, wp1.id)),
    )
    check(
      'merge-preserves-non-imported',
      getPlannedYear(mergedPlan, wp3.id) === year2026 && mergeReport.preservedWorkplaceIds.includes(wp3.id),
      `${getPlannedYear(mergedPlan, wp3.id)} preserved=${mergeReport.preservedWorkplaceIds.includes(wp3.id)}`,
    )

    const replaceReport = applySupervisionPlanImport('replace', modifiedPlan, parsed.data, activeIds).report
    check(
      'replace-clears-missing',
      replaceReport.clearedWorkplaceIds.includes(wp3.id) && getPlannedYear(
        applySupervisionPlanImport('replace', modifiedPlan, parsed.data, activeIds).plan,
        wp3.id,
      ) === null,
      `cleared ${replaceReport.clearedWorkplaceIds.includes(wp3.id)}`,
    )

    const undoSnapshot = modifiedPlan
    const { plan: afterImport } = applySupervisionPlanImport('replace', modifiedPlan, parsed.data, activeIds)
    const undone = undoSnapshot
    check('undo-restores-plan', plansAreEqual(undone, modifiedPlan) && !plansAreEqual(afterImport, modifiedPlan), 'snapshot restore')

    const fileWithUnknown = structuredClone(parsed.data)
    fileWithUnknown.plan.assignments.push({
      workplaceId: 'unknown-workplace-id',
      plannedYear: year2026,
      workplaceNameSnapshot: 'Ghost Office',
    })
    const unknownReport = applySupervisionPlanImport('replace', sourcePlan, fileWithUnknown, activeIds).report
    check(
      'unknown-workplace-ignored',
      unknownReport.ignoredUnknownWorkplaceIds.includes('unknown-workplace-id'),
      unknownReport.ignoredUnknownWorkplaceIds.join(','),
    )
    const unknownPreview = buildSupervisionPlanImportPreview(fileWithUnknown, sourcePlan, activeIds)
    check(
      'unknown-workplace-preview',
      unknownPreview.unknownWorkplaceIds.some((item) => item.workplaceId === 'unknown-workplace-id'),
      `${unknownPreview.unknownWorkplaceIds.length}`,
    )
  }

  const invalidJson = parseSupervisionPlanImportJson('{ not json')
  check('reject-invalid-json', !invalidJson.ok, invalidJson.errors[0]?.message ?? '')

  const wrongType = validateSupervisionPlanImportFile({
    fileType: 'wrong-type',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    plan: exportFile.plan,
    metadata: exportFile.metadata,
  })
  check('reject-wrong-file-type', !wrongType.ok, wrongType.errors[0]?.message ?? '')

  const badVersion = validateSupervisionPlanImportFile({
    ...exportFile,
    formatVersion: 99,
  })
  check('reject-unsupported-version', !badVersion.ok, badVersion.errors[0]?.message ?? '')

  const duplicateYear = validateSupervisionPlanImportFile({
    ...exportFile,
    plan: {
      ...exportFile.plan,
      years: [
        ...exportFile.plan.years,
        { ...exportFile.plan.years[0]! },
      ],
    },
  })
  check('reject-duplicate-year', !duplicateYear.ok, duplicateYear.errors[0]?.message ?? '')

  const duplicateWp = validateSupervisionPlanImportFile({
    ...exportFile,
    plan: {
      ...exportFile.plan,
      assignments: [
        ...exportFile.plan.assignments,
        { ...exportFile.plan.assignments[0]! },
      ],
    },
  })
  check('reject-duplicate-workplace', !duplicateWp.ok, duplicateWp.errors[0]?.message ?? '')

  const badPlannedYear = validateSupervisionPlanImportFile({
    ...exportFile,
    plan: {
      ...exportFile.plan,
      assignments: exportFile.plan.assignments.map((a, index) =>
        index === 0 ? { ...a, plannedYear: 1999 } : a,
      ),
    },
  })
  check('reject-invalid-planned-year', !badPlannedYear.ok, badPlannedYear.errors[0]?.message ?? '')

  const missingYearRef = validateSupervisionPlanImportFile({
    ...exportFile,
    plan: {
      ...exportFile.plan,
      assignments: exportFile.plan.assignments.map((a, index) =>
        index === 0 ? { ...a, plannedYear: 2099 } : a,
      ),
    },
  })
  check('reject-unknown-planned-year', !missingYearRef.ok, missingYearRef.errors[0]?.message ?? '')

  const hugeFile = parseSupervisionPlanImportJson(' '.repeat(MAX_SUPERVISION_PLAN_IMPORT_BYTES + 1))
  check('reject-file-too-large', !hugeFile.ok, hugeFile.errors[0]?.message ?? '')

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-supervision-plan-json ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
