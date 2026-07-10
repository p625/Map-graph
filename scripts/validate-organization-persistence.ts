/**
 * Validace persistence organizačních dat (Phase 5C.4).
 * Spuštění: npm run validate-organization-persistence
 */
import { districts } from '../src/data/seed/districts.ts'
import {
  isEmptyOrganizationSeed,
  isOrganizationSynced,
  normalizePersistedOrganization,
} from '../src/domain/organization/organizationState.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
  snapshotToConfigAssignments,
} from '../src/domain/organization/organizationSync.ts'
import { byLeaderPlugin } from '../src/domain/visualization/plugins/byLeaderPlugin.ts'
import { byRegionalOfficePlugin } from '../src/domain/visualization/plugins/byRegionalOfficePlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { OrganizationSnapshot } from '../src/domain/organization/types.ts'
import type {
  DistrictWorkplaceAssignments,
  WorkplaceRegionalAssignments,
} from '../src/domain/types/assignment.ts'
import { buildDefaultDistrictAssignments } from '../src/utils/storage.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')
const ORG_STORAGE_KEY = 'map-graph-org-v1'
const CONFIG_STORAGE_KEY = 'map-graph-config-v4'

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []

function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function simulateLoadOrganization(stored: OrganizationSnapshot | null): OrganizationSnapshot {
  if (!stored || isEmptyOrganizationSeed(stored)) {
    return seedOrganizationFromWorkplaces()
  }
  return normalizePersistedOrganization(stored)
}

interface SimulatedConfigState {
  districtWorkplaceAssignments: DistrictWorkplaceAssignments
  workplaceRegionalAssignments: WorkplaceRegionalAssignments
  districtDisplayColors: Record<string, string>
}

function simulateLoadConfig(
  stored: Partial<SimulatedConfigState> | null,
  orgSnapshot: OrganizationSnapshot | null,
): SimulatedConfigState {
  const base: SimulatedConfigState = {
    districtWorkplaceAssignments:
      stored?.districtWorkplaceAssignments ??
      buildDefaultDistrictAssignments(districts, seedWorkplaces),
    workplaceRegionalAssignments: stored?.workplaceRegionalAssignments ?? {},
    districtDisplayColors: stored?.districtDisplayColors ?? {},
  }

  if (orgSnapshot && isOrganizationSynced(orgSnapshot)) {
    const fromOrg = snapshotToConfigAssignments(orgSnapshot)
    return {
      ...base,
      districtWorkplaceAssignments: fromOrg.districtWorkplaceAssignments,
      workplaceRegionalAssignments: fromOrg.workplaceRegionalAssignments,
    }
  }

  return base
}

function buildVisualizationContext(
  snapshot: OrganizationSnapshot,
  config: SimulatedConfigState,
) {
  const activeWorkplaces = snapshot.workplaces
    .filter((wp) => !wp.absentFromSync)
    .map((wp) => ({ id: wp.id, code: wp.code ?? wp.id, name: wp.name }))

  return {
    districts,
    workplaces: activeWorkplaces,
    regionalOffices: snapshot.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: config.districtWorkplaceAssignments,
    workplaceRegionalAssignments: config.workplaceRegionalAssignments,
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
  const syncedSnapshot = mergeOrganizationSnapshots(seed, preview.incoming, preview.defaultResolutions)

  const active = syncedSnapshot.workplaces.filter((wp) => !wp.absentFromSync)

  check('count-workplaces', active.length === 65, `${active.length} aktivních`)
  check('count-districts', syncedSnapshot.districtAssignments.length >= 77, `${syncedSnapshot.districtAssignments.length} přiřazení`)
  check('count-leaders', syncedSnapshot.leaders.length === 16, `${syncedSnapshot.leaders.length} vedoucích`)
  check('count-regions', syncedSnapshot.regions.length === 7, `${syncedSnapshot.regions.length} regionů`)

  check(
    'workplace-region',
    active.every((wp) => Boolean(wp.regionId)),
    `${active.filter((wp) => wp.regionId).length}/${active.length}`,
  )
  check(
    'workplace-leader',
    active.every((wp) => Boolean(wp.leaderId)),
    `${active.filter((wp) => wp.leaderId).length}/${active.length}`,
  )
  check(
    'workplace-org-unit',
    active.every((wp) => Boolean(wp.orgUnitId)),
    `${active.filter((wp) => wp.orgUnitId).length}/${active.length}`,
  )

  const memory = new Map<string, string>()
  const saveJson = (key: string, value: unknown) => memory.set(key, JSON.stringify(value))
  const loadJson = <T,>(key: string, fallback: T): T => {
    const raw = memory.get(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  }

  saveJson(ORG_STORAGE_KEY, syncedSnapshot)
  const reloadedOrg = simulateLoadOrganization(
    loadJson<OrganizationSnapshot | null>(ORG_STORAGE_KEY, null),
  )

  check('persistence-org-regions', reloadedOrg.regions.length === 7, `${reloadedOrg.regions.length}`)
  check('persistence-org-leaders', reloadedOrg.leaders.length === 16, `${reloadedOrg.leaders.length}`)
  check(
    'persistence-org-districts',
    reloadedOrg.districtAssignments.length >= 77,
    `${reloadedOrg.districtAssignments.length}`,
  )

  const configAfterSync = snapshotToConfigAssignments(syncedSnapshot)
  saveJson(CONFIG_STORAGE_KEY, {
    districtWorkplaceAssignments: configAfterSync.districtWorkplaceAssignments,
    workplaceRegionalAssignments: configAfterSync.workplaceRegionalAssignments,
    districtDisplayColors: {},
  })

  const reloadedConfig = simulateLoadConfig(
    loadJson<Partial<SimulatedConfigState> | null>(CONFIG_STORAGE_KEY, null),
    reloadedOrg,
  )

  check(
    'persistence-district-assignments',
    Object.keys(reloadedConfig.districtWorkplaceAssignments).length === 77,
    `${Object.keys(reloadedConfig.districtWorkplaceAssignments).length} okresů`,
  )
  check(
    'persistence-regional-assignments',
    Object.keys(reloadedConfig.workplaceRegionalAssignments).length === 65,
    `${Object.keys(reloadedConfig.workplaceRegionalAssignments).length} pracovišť`,
  )

  const leaderColors = byLeaderPlugin.resolveColors(buildVisualizationContext(reloadedOrg, reloadedConfig))
  const leaderLegend = byLeaderPlugin.buildLegend(buildVisualizationContext(reloadedOrg, reloadedConfig))
  check(
    'map-by-leader-colors',
    Object.keys(leaderColors).length === 77,
    `${Object.keys(leaderColors).length} okresů obarveno`,
  )
  check(
    'map-by-leader-legend',
    leaderLegend.items.length === 16,
    `${leaderLegend.items.length} vedoucích v legendě`,
  )

  const regionalColors = byRegionalOfficePlugin.resolveColors(
    buildVisualizationContext(reloadedOrg, reloadedConfig),
  )
  const regionalLegend = byRegionalOfficePlugin.buildLegend(
    buildVisualizationContext(reloadedOrg, reloadedConfig),
  )
  check(
    'map-by-regional-colors',
    Object.keys(regionalColors).length === 77,
    `${Object.keys(regionalColors).length} okresů`,
  )
  check(
    'map-by-regional-legend',
    regionalLegend.items.length === 7,
    `${regionalLegend.items.length} regionů v legendě`,
  )

  saveJson(ORG_STORAGE_KEY, syncedSnapshot)
  const emptySeed = seedOrganizationFromWorkplaces()
  const shouldNotOverwrite = simulateLoadOrganization(
    loadJson<OrganizationSnapshot | null>(ORG_STORAGE_KEY, null),
  )
  check(
    'seed-does-not-overwrite-storage',
    shouldNotOverwrite.regions.length === 7 && !isEmptyOrganizationSeed(shouldNotOverwrite),
    `regionů ${shouldNotOverwrite.regions.length}, seed=${isEmptyOrganizationSeed(shouldNotOverwrite)}`,
  )

  const legacySnapshot: OrganizationSnapshot = {
    ...syncedSnapshot,
    syncedAt: undefined,
  }
  check(
    'legacy-without-synced-at',
    isOrganizationSynced(legacySnapshot),
    'sync detekován podle obsahu',
  )

  const reloadedLegacy = normalizePersistedOrganization(legacySnapshot)
  check(
    'legacy-normalized',
    Boolean(reloadedLegacy.syncedAt) && isOrganizationSynced(reloadedLegacy),
    `syncedAt=${Boolean(reloadedLegacy.syncedAt)}`,
  )

  check(
    'empty-seed-not-persisted',
    isEmptyOrganizationSeed(emptySeed),
    'prázdný seed rozpoznán',
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE ORGANIZATION PERSISTENCE (5C.4) ===\n')
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
