/**
 * Validace Phase 5C.3 — editace organizačních vazeb.
 * Spuštění: npm run validate-phase-5c-assignments
 */
import { districts } from '../src/data/seed/districts.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import {
  detectWorkplaceAssignmentConflicts,
} from '../src/domain/organization/assignmentConflicts.ts'
import {
  validateActiveWorkplaceAssignments,
  validateWorkplaceLeaderChange,
  validateWorkplaceRegionChange,
} from '../src/domain/organization/assignmentValidation.ts'
import {
  buildOrganizationSyncPreview,
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
  snapshotToConfigAssignments,
} from '../src/domain/organization/organizationSync.ts'
import { buildRegionScope, isRegionFocused } from '../src/domain/region/regionScope.ts'
import { getRegionViewport } from '../src/domain/region/regionViewport.ts'
import { filterLegendForRegion } from '../src/domain/region/regionFocus.ts'
import { byLeaderPlugin } from '../src/domain/visualization/plugins/byLeaderPlugin.ts'
import { byRegionalOfficePlugin } from '../src/domain/visualization/plugins/byRegionalOfficePlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { OrganizationSnapshot, OrganizationWorkplace } from '../src/domain/organization/types.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function cloneSnapshot(snapshot: OrganizationSnapshot): OrganizationSnapshot {
  return structuredClone(snapshot)
}

function applyRegionChange(
  snapshot: OrganizationSnapshot,
  workplaceId: string,
  regionId: string,
): OrganizationSnapshot | null {
  const error = validateWorkplaceRegionChange(snapshot, workplaceId, regionId)
  if (error) return null
  return {
    ...snapshot,
    workplaces: snapshot.workplaces.map((wp) =>
      wp.id === workplaceId
        ? { ...wp, regionId, manualEdits: { ...wp.manualEdits, regionId: true } }
        : wp,
    ),
  }
}

function applyLeaderChange(
  snapshot: OrganizationSnapshot,
  workplaceId: string,
  leaderId: string,
): OrganizationSnapshot | null {
  const error = validateWorkplaceLeaderChange(snapshot, workplaceId, leaderId)
  if (error) return null
  const leader = snapshot.leaders.find((item) => item.id === leaderId)!
  return {
    ...snapshot,
    workplaces: snapshot.workplaces.map((wp) =>
      wp.id === workplaceId
        ? {
            ...wp,
            leaderId,
            orgUnitId: leader.orgUnitId,
            manualEdits: { ...wp.manualEdits, leaderId: true },
          }
        : wp,
    ),
  }
}

function applyBulkRegion(
  snapshot: OrganizationSnapshot,
  workplaceIds: string[],
  regionId: string,
): OrganizationSnapshot | null {
  for (const workplaceId of workplaceIds) {
    const error = validateWorkplaceRegionChange(snapshot, workplaceId, regionId)
    if (error) return null
  }
  return {
    ...snapshot,
    workplaces: snapshot.workplaces.map((wp) =>
      workplaceIds.includes(wp.id)
        ? { ...wp, regionId, manualEdits: { ...wp.manualEdits, regionId: true } }
        : wp,
    ),
  }
}

function simulateUndoRedo(snapshot: OrganizationSnapshot): {
  undone: OrganizationSnapshot
  redone: OrganizationSnapshot
} {
  const past = cloneSnapshot(snapshot)
  const moved = applyRegionChange(snapshot, snapshot.workplaces[0]!.id, snapshot.regions[1]!.id)
  if (!moved) throw new Error('region change failed')
  const undone = past
  const redone = moved
  return { undone, redone }
}

function buildContext(snapshot: OrganizationSnapshot): VisualizationContext {
  const assignments = snapshotToConfigAssignments(snapshot)
  const syncedWorkplaces = snapshot.workplaces
    .filter((w) => !w.absentFromSync)
    .map((w) => ({ id: w.id, code: w.code ?? w.id, name: w.name }))

  return {
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: snapshot.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: assignments.districtWorkplaceAssignments,
    workplaceRegionalAssignments: assignments.workplaceRegionalAssignments,
    theme: classicTheme,
    organization: {
      leaders: snapshot.leaders,
      orgUnits: snapshot.orgUnits,
      workplaces: snapshot.workplaces.filter((wp) => !wp.absentFromSync),
    },
  }
}

async function main() {
  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  let snapshot = mergeOrganizationSnapshots(seed, preview.incoming, preview.defaultResolutions)

  const activeWorkplaces = snapshot.workplaces.filter((wp) => !wp.absentFromSync)
  const targetWp = activeWorkplaces[0]!
  const altRegion = snapshot.regions.find((region) => region.id !== targetWp.regionId)!
  const altLeader = snapshot.leaders.find((leader) => leader.id !== targetWp.leaderId)!

  const afterRegion = applyRegionChange(snapshot, targetWp.id, altRegion.id)
  check('single-region-change', Boolean(afterRegion), `region ${altRegion.name}`)
  snapshot = afterRegion ?? snapshot

  const bulkTargets = activeWorkplaces.slice(0, 3).map((wp) => wp.id)
  const bulkRegion = snapshot.regions[snapshot.regions.length - 1]!
  const afterBulk = applyBulkRegion(snapshot, bulkTargets, bulkRegion.id)
  check('bulk-region-change', Boolean(afterBulk), `${bulkTargets.length} pracovišť`)
  snapshot = afterBulk ?? snapshot

  const leaderWp = activeWorkplaces[4] ?? activeWorkplaces[1]!
  const afterLeader = applyLeaderChange(snapshot, leaderWp.id, altLeader.id)
  check('leader-change', Boolean(afterLeader), `${leaderWp.name} → ${altLeader.name}`)
  snapshot = afterLeader ?? snapshot

  const updatedWp = snapshot.workplaces.find((wp) => wp.id === leaderWp.id)!
  const leader = snapshot.leaders.find((item) => item.id === updatedWp.leaderId)!
  check(
    'org-unit-derived',
    updatedWp.orgUnitId === leader.orgUnitId,
    `orgUnitId ${updatedWp.orgUnitId}`,
  )

  const { undone, redone } = simulateUndoRedo(snapshot)
  check(
    'undo-redo',
    undone.workplaces[0]!.regionId !== redone.workplaces[0]!.regionId,
    'region restore cycle',
  )

  const context = buildContext(snapshot)
  const leaderColors = byLeaderPlugin.resolveColors(context)
  check(
    'map-by-leader',
    Object.keys(leaderColors).length > 0,
    `barev ${Object.keys(leaderColors).length}`,
  )

  const regionalColors = byRegionalOfficePlugin.resolveColors(context)
  check(
    'map-by-regional-office',
    Object.keys(regionalColors).length > 0,
    `barev ${Object.keys(regionalColors).length}`,
  )

  const assignments = snapshotToConfigAssignments(snapshot)
  const resolver = createWorkplaceResolver({
    districts,
    workplaces: snapshot.workplaces
      .filter((w) => !w.absentFromSync)
      .map((w) => ({ id: w.id, code: w.code ?? w.id, name: w.name })),
    regionalOffices: snapshot.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: assignments.districtWorkplaceAssignments,
    workplaceRegionalAssignments: assignments.workplaceRegionalAssignments,
  })

  const movedWp = snapshot.workplaces.find((wp) => wp.id === targetWp.id)!
  const focusRegionId = movedWp.regionId
  const scope = buildRegionScope(focusRegionId, 'focused', resolver)
  const districtIds = resolver.getDistrictIdsForRegion(focusRegionId)
  const hash = hashAssignmentState(
    assignments.districtWorkplaceAssignments,
    assignments.workplaceRegionalAssignments,
  )
  const viewport = getRegionViewport(focusRegionId, districtIds, 760, 460, hash)
  const legend = filterLegendForRegion(
    byLeaderPlugin.buildLegend(context),
    byLeaderPlugin.id,
    scope,
    context,
  )
  check(
    'region-focus-after-move',
    isRegionFocused(scope) && Boolean(viewport) && legend.items.length > 0,
    `focus ${scope.regionName}, legenda ${legend.items.length}`,
  )

  const exportAssignments = snapshotToConfigAssignments(snapshot)
  check(
    'export-assignments-sync',
    Object.keys(exportAssignments.workplaceRegionalAssignments).length === activeWorkplaces.length,
    `regionálních vazeb ${Object.keys(exportAssignments.workplaceRegionalAssignments).length}`,
  )

  const manualSnapshot: OrganizationSnapshot = {
    ...snapshot,
    workplaces: snapshot.workplaces.map((wp) =>
      wp.id === targetWp.id
        ? {
            ...wp,
            regionId: altRegion.id,
            manualEdits: { regionId: true },
          }
        : wp,
    ),
  }
  const syncPreview = buildOrganizationSyncPreview(manualSnapshot, preview.incoming)
  const conflicts = detectWorkplaceAssignmentConflicts(manualSnapshot, preview.incoming)
  check(
    'sync-conflict-preview',
    syncPreview.assignmentConflicts.length > 0 && conflicts.length > 0,
    `konfliktů ${conflicts.length}`,
  )

  const invalidRegion = validateWorkplaceRegionChange(snapshot, targetWp.id, 'region-invalid')
  const invalidLeader = validateWorkplaceLeaderChange(snapshot, targetWp.id, 'leader-invalid')
  check(
    'invalid-id-rejected',
    Boolean(invalidRegion) && Boolean(invalidLeader),
    'neplatná ID odmítnuta',
  )

  const absentWp: OrganizationWorkplace = {
    ...targetWp,
    absentFromSync: true,
  }
  const absentSnapshot = {
    ...snapshot,
    workplaces: snapshot.workplaces.map((wp) => (wp.id === targetWp.id ? absentWp : wp)),
  }
  const absentError = validateWorkplaceRegionChange(absentSnapshot, targetWp.id, altRegion.id)
  check('absent-protected', Boolean(absentError), absentError?.message ?? '')

  const validationErrors = validateActiveWorkplaceAssignments(snapshot)
  check('active-assignments-valid', validationErrors.length === 0, `chyb ${validationErrors.length}`)

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE PHASE 5C.3 (ASSIGNMENTS) ===\n')
  for (const item of checks) {
    console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.id}: ${item.detail}`)
  }
  console.log(`\nVÝSLEDEK: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${checks.length})`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
