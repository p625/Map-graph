/**
 * Validace plánu supervizí — datový model, tabulka, barvy, mapa, persistence, export.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { createDefaultSupervisionPlan } from '../src/domain/supervision-plan/supervisionPlanDefaults.ts'
import { buildSupervisionPlanExportRows } from '../src/domain/supervision-plan/supervisionPlanExport.ts'
import { sanitizeSupervisionPlan, hasDuplicateYears } from '../src/domain/supervision-plan/supervisionPlanSanitize.ts'
import {
  computeSupervisionPlanSummary,
  getPlannedYear,
} from '../src/domain/supervision-plan/supervisionPlanSummary.ts'
import {
  buildSupervisionPlanTableRows,
  filterSupervisionPlanTableRows,
} from '../src/domain/supervision-plan/supervisionPlanTable.ts'
import { syncSupervisionPlanWithOrganization } from '../src/domain/supervision-plan/syncWithOrganization.ts'
import {
  SUPERVISION_DIMMED_COLOR,
  SUPERVISION_PLAN_STORAGE_KEY,
  SUPERVISION_UNPLANNED_COLOR,
} from '../src/domain/supervision-plan/types.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { supervisionPlanPlugin } from '../src/domain/visualization/plugins/supervisionPlanPlugin.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')
const WIDTH = 760
const HEIGHT = 460

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

async function main() {
  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)

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

  const activeWorkplaces = merged.workplaces
    .filter((workplace) => !workplace.absentFromSync)
    .map((workplace) => {
      const seedWp = seedWorkplaces.find((item) => item.id === workplace.id)
      return { id: workplace.id, code: seedWp?.code ?? workplace.id, name: workplace.name }
    })

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: activeWorkplaces,
    regionalOffices: merged.regions.map((region) => ({
      id: region.id,
      code: region.code,
      name: region.name,
    })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
  })

  const assignmentHash = hashAssignmentState(districtAssignments, regionalAssignments)
  const territories = buildTerritoryLayers({
    resolver,
    width: WIDTH,
    height: HEIGHT,
    boundaryVisibility: { district: false, workplace: false, region: false },
    assignmentHash,
  })

  let plan = createDefaultSupervisionPlan(2026)
  const wp1 = activeWorkplaces[0]!
  const wp2 = activeWorkplaces[1]!
  const year2027 = plan.years.find((y) => y.year === 2027)?.year ?? 2027

  plan = sanitizeSupervisionPlan({
    ...plan,
    assignments: {
      [wp1.id]: { workplaceId: wp1.id, plannedYear: 2026, updatedAt: new Date().toISOString() },
      [wp2.id]: { workplaceId: wp2.id, plannedYear: year2027, updatedAt: new Date().toISOString() },
    },
  })

  check('single-year-per-workplace', getPlannedYear(plan, wp1.id) === 2026, `${getPlannedYear(plan, wp1.id)}`)
  check('unplanned-null', getPlannedYear(plan, activeWorkplaces[2]?.id ?? 'missing') === null, 'null')
  check('no-duplicate-years-config', !hasDuplicateYears(plan.years), `${plan.years.length} years`)

  const tableRows = buildSupervisionPlanTableRows(merged, plan)
  check('table-row-count', tableRows.length === activeWorkplaces.length, `${tableRows.length}/${activeWorkplaces.length}`)

  plan = sanitizeSupervisionPlan({
    ...plan,
    assignments: {
      ...plan.assignments,
      [wp1.id]: { workplaceId: wp1.id, plannedYear: year2027, updatedAt: new Date().toISOString() },
    },
  })
  check('year-change', getPlannedYear(plan, wp1.id) === year2027, `${getPlannedYear(plan, wp1.id)}`)

  const customColor = '#ff00aa'
  const colorPlan = sanitizeSupervisionPlan({
    ...createDefaultSupervisionPlan(2026),
    assignments: {
      [wp1.id]: { workplaceId: wp1.id, plannedYear: 2026, updatedAt: new Date().toISOString() },
      [wp2.id]: { workplaceId: wp2.id, plannedYear: year2027, updatedAt: new Date().toISOString() },
    },
    years: createDefaultSupervisionPlan(2026).years.map((y) =>
      y.year === 2026 ? { ...y, color: customColor } : y,
    ),
  })

  const filteredByYear = filterSupervisionPlanTableRows(
    buildSupervisionPlanTableRows(merged, plan),
    {
      search: '',
      regionId: '',
      leaderId: '',
      orgUnitId: '',
      plannedYear: year2027,
    },
    merged,
  )
  check(
    'filter-by-year',
    filteredByYear.length >= 2 && filteredByYear.every((row) => row.plannedYear === year2027),
    `${filteredByYear.length} rows`,
  )

  const summary = computeSupervisionPlanSummary(plan, merged.workplaces.filter((wp) => !wp.absentFromSync))
  check(
    'summary-total',
    summary.plannedCount + summary.unplannedCount === summary.totalWorkplaces,
    `${summary.plannedCount}+${summary.unplannedCount}=${summary.totalWorkplaces}`,
  )

  const memory = new Map<string, string>()
  memory.set(SUPERVISION_PLAN_STORAGE_KEY, JSON.stringify(colorPlan))
  const reloaded = sanitizeSupervisionPlan(JSON.parse(memory.get(SUPERVISION_PLAN_STORAGE_KEY)!))
  check(
    'color-persist-reload',
    reloaded.years.find((y) => y.year === 2026)?.color === customColor,
    reloaded.years.find((y) => y.year === 2026)?.color ?? '',
  )

  const baseContext: VisualizationContext = {
    districts,
    workplaces: activeWorkplaces,
    regionalOffices: resolver.regionalOffices,
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    organization: {
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces.filter((wp) => !wp.absentFromSync),
    },
    theme: classicTheme,
  }

  const allYearsContext: VisualizationContext = {
    ...baseContext,
    supervisionPlan: { ...colorPlan, yearFilter: 'all' },
  }
  const allColors = supervisionPlanPlugin.resolveColors(allYearsContext)
  const wp1District = Object.entries(districtAssignments).find(([, id]) => id === wp1.id)?.[0]
  check(
    'map-all-years-color',
    Boolean(wp1District && allColors[wp1District]?.fill === customColor),
    wp1District ? allColors[wp1District]?.fill : 'no district',
  )

  const filteredContext: VisualizationContext = {
    ...baseContext,
    supervisionPlan: { ...reloaded, yearFilter: year2027 },
  }
  const filteredColors = supervisionPlanPlugin.resolveColors(filteredContext)
  const wp2District = Object.entries(districtAssignments).find(([, id]) => id === wp2.id)?.[0]
  const wp3 = activeWorkplaces[2]
  const wp3District = wp3 ? Object.entries(districtAssignments).find(([, id]) => id === wp3.id)?.[0] : undefined
  check(
    'map-selected-year-highlight',
    Boolean(
      wp2District &&
        filteredColors[wp2District]?.fill === reloaded.years.find((y) => y.year === year2027)?.color,
    ),
    wp2District ? filteredColors[wp2District]?.fill : '',
  )
  check(
    'map-other-workplaces-dimmed',
    Boolean(wp3District && filteredColors[wp3District]?.fill === SUPERVISION_DIMMED_COLOR),
    wp3District ? filteredColors[wp3District]?.fill : '',
  )

  const legend = supervisionPlanPlugin.buildLegend(allYearsContext)
  check('legend-has-years', legend.items.length >= colorPlan.years.length, `${legend.items.length} items`)
  check(
    'legend-unplanned-last',
    legend.items[legend.items.length - 1]?.id === 'unplanned',
    legend.items[legend.items.length - 1]?.label ?? '',
  )

  const labels = buildMapLabels({
    resolver,
    territories,
    context: {
      ...allYearsContext,
      supervisionPlan: { ...reloaded, yearFilter: 'all' },
    },
    contentMode: 'supervision-name-year',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const wp1Label = labels.find((label) => label.id === `label-workplace-${wp1.id}`)
  check(
    'label-name-and-year',
    Boolean(wp1Label?.valueText === '2026' && wp1Label.text.includes('2026')),
    wp1Label?.text ?? 'missing',
  )

  const resynced = syncSupervisionPlanWithOrganization(reloaded, merged.workplaces.filter((wp) => !wp.absentFromSync))
  check(
    'org-resync-preserve',
    getPlannedYear(resynced, wp1.id) === 2026,
    `${getPlannedYear(resynced, wp1.id)}`,
  )

  const exportRows = buildSupervisionPlanExportRows(merged, reloaded)
  const exportWp1 = exportRows.find((row) => row.workplace === merged.workplaces.find((w) => w.id === wp1.id)?.name)
  check('export-planned-year-column', exportWp1?.plannedYear === '2026', exportWp1?.plannedYear ?? '')

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    context: filteredContext,
    contentMode: 'supervision-name-year',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const exportLabel = exportLabels.find((label) => label.id === `label-workplace-${wp2.id}`)
  check('export-map-label-parity', exportLabel?.valueText === String(year2027), exportLabel?.valueText ?? '')

  check('unplanned-color-constant', SUPERVISION_UNPLANNED_COLOR.length > 0, SUPERVISION_UNPLANNED_COLOR)

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-supervision-plan ===\n')
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
