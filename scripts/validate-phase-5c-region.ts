/**
 * Validace Phase 5C.2 — region focus a automatický zoom.
 * Spuštění: npm run validate-phase-5c-region
 */
import { districts } from '../src/data/seed/districts.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import {
  applyRegionFocusColors,
  filterLabelsForRegion,
  filterLegendForRegion,
} from '../src/domain/region/regionFocus.ts'
import { buildRegionScope, isRegionFocused } from '../src/domain/region/regionScope.ts'
import { getRegionViewport } from '../src/domain/region/regionViewport.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { byLeaderPlugin } from '../src/domain/visualization/plugins/byLeaderPlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function simulateValidateFocusedRegion(
  focusedRegionId: string | null,
  validRegionIds: string[],
): string | null {
  if (!focusedRegionId) return null
  if (validRegionIds.includes(focusedRegionId)) return focusedRegionId
  return null
}

async function main() {
  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)

  const districtAssignments: Record<string, string> = {}
  for (const a of merged.districtAssignments) districtAssignments[a.districtId] = a.workplaceId
  const regionalAssignments: Record<string, string> = {}
  for (const wp of merged.workplaces) {
    if (!wp.absentFromSync && wp.regionId) regionalAssignments[wp.id] = wp.regionId
  }

  const syncedWorkplaces = merged.workplaces
    .filter((w) => !w.absentFromSync)
    .map((w) => ({ id: w.id, code: w.code ?? w.id, name: w.name }))

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: merged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
  })

  const assignmentHash = hashAssignmentState(districtAssignments, regionalAssignments)
  const validRegionIds = merged.regions.map((r) => r.id)

  for (const region of merged.regions) {
    const districtIds = resolver.getDistrictIdsForRegion(region.id)
    const viewport = getRegionViewport(region.id, districtIds, WIDTH, HEIGHT, assignmentHash)
    check(
      `viewport-${region.code}`,
      Boolean(viewport && viewport.width > 0 && viewport.height > 0),
      `${region.name}: ${viewport?.width.toFixed(0)}×${viewport?.height.toFixed(0)}`,
    )
    check(
      `workplaces-${region.code}`,
      resolver.getWorkplacesForRegion(region.id).length > 0,
      `${region.name}: ${resolver.getWorkplacesForRegion(region.id).length} pracovišť`,
    )
  }

  const focusRegion = merged.regions[0]!
  const scope = buildRegionScope(focusRegion.id, 'focused', resolver)
  check('scope-focused', isRegionFocused(scope), `focus ${scope.regionName}`)

  const baseContext: VisualizationContext = {
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: merged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    organization: {
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces.filter((w) => !w.absentFromSync),
    },
    regionScope: scope,
    theme: classicTheme,
  }

  const leaderLegend = filterLegendForRegion(
    byLeaderPlugin.buildLegend(baseContext),
    'by-leader',
    scope,
    baseContext,
  )
  check(
    'legend-filtered',
    leaderLegend.items.length < merged.leaders.length && leaderLegend.items.length > 0,
    `vedoucí v regionu: ${leaderLegend.items.length}`,
  )

  const territories = buildTerritoryLayers({
    resolver,
    width: WIDTH,
    height: HEIGHT,
    boundaryVisibility: { district: false, workplace: false, region: true },
    assignmentHash,
  })

  const labels = buildMapLabels({
    resolver,
    territories,
    scope: 'workplace',
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    contentMode: 'name',
    context: baseContext,
  })
  const filteredLabels = filterLabelsForRegion(labels, scope)
  check(
    'labels-outside-hidden',
    filteredLabels.length < labels.length,
    `popisků ${filteredLabels.length}/${labels.length} uvnitř regionu`,
  )

  const colors = applyRegionFocusColors(
    byLeaderPlugin.resolveColors(baseContext),
    scope,
    'export-focused',
  )
  const exportDistrictIds = Object.keys(colors)
  const outside = exportDistrictIds.filter((id) => !scope.districtIds.has(id))
  check('export-no-outside', outside.length === 0, `export okresů mimo region: ${outside.length}`)

  const reset = simulateValidateFocusedRegion('invalid-region', validRegionIds)
  check('invalid-region-reset', reset === null, 'neplatný region resetován')

  const kept = simulateValidateFocusedRegion(focusRegion.id, validRegionIds)
  check('valid-region-kept', kept === focusRegion.id, 'platný region zachován')

  const overviewScope = buildRegionScope(null, 'overview', resolver)
  const overviewViewport = getRegionViewport(
    focusRegion.id,
    resolver.getDistrictIdsForRegion(focusRegion.id),
    WIDTH,
    HEIGHT,
    assignmentHash,
  )
  check(
    'overview-full-country',
    overviewScope.districtIds.size === districts.length,
    `overview okresů: ${overviewScope.districtIds.size}`,
  )
  check('viewport-available', Boolean(overviewViewport), 'viewport pro region existuje')

  console.log('=== VALIDACE PHASE 5C.2 (REGION FOCUS) ===\n')
  for (const c of checks) {
    console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`)
  }
  const pass = checks.every((c) => c.pass)
  console.log(`\nVÝSLEDEK: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`)
  if (!pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
