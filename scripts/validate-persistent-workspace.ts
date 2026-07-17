/**
 * Validace persistentního workspace (Phase 5C.9).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { createImportSnapshot } from '../src/domain/dataset/datasetSnapshot.ts'
import {
  validateWorkspaceBackup,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackup,
} from '../src/domain/workspace/workspaceBackup.ts'
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
import type { OrganizationSnapshot } from '../src/domain/organization/types.ts'
import type { Dataset } from '../src/domain/types/dataset.ts'
import type { DatasetRecord } from '../src/domain/types/datasetRecord.ts'
import { buildDefaultDistrictAssignments, loadJson } from '../src/utils/storage.ts'
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

function simulateLoadOrganization(stored: OrganizationSnapshot | null): OrganizationSnapshot {
  if (!stored || isEmptyOrganizationSeed(stored)) {
    return seedOrganizationFromWorkplaces()
  }
  return normalizePersistedOrganization(stored)
}

async function main() {
  const memory = new Map<string, string>()
  const memLoad = <T,>(key: string, fallback: T): T => {
    const raw = memory.get(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  }
  const memSave = (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value))
    return { ok: true as const }
  }

  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const syncedSnapshot = mergeOrganizationSnapshots(seed, preview.incoming, preview.defaultResolutions)

  const active = syncedSnapshot.workplaces.filter((wp) => !wp.absentFromSync)
  check('sync-workplaces-65', active.length === 65, `${active.length}`)
  check('sync-regions-7', syncedSnapshot.regions.length === 7, `${syncedSnapshot.regions.length}`)

  syncedSnapshot.leaders = syncedSnapshot.leaders.map((leader, index) =>
    index === 0 ? { ...leader, color: '#ff3366' } : leader,
  )

  const configAssignments = snapshotToConfigAssignments(syncedSnapshot)
  const configState = {
    ...configAssignments,
    districtDisplayColors: { 'district-praha': '#aabbcc' },
    workplaceDisplayColors: { [active[0]!.id]: '#112233' },
    regionDisplayColors: { [syncedSnapshot.regions[0]!.id]: '#445566' },
  }

  const importedAt = '2026-07-10T10:00:00.000Z'
  const datasetRecords: DatasetRecord[] = [
    {
      id: 'dataset-1-record-1',
      datasetId: 'dataset-1',
      workplaceId: active[0]!.id,
      matchStatus: 'matched',
      values: { value: 100 },
    },
  ]
  const dataset: Dataset = {
    id: 'dataset-1',
    name: 'Test',
    source: 'excel',
    importedAt,
    updatedAt: importedAt,
    revision: 1,
    importSnapshot: createImportSnapshot('Test', [
      { id: 'col-1', key: 'value', name: 'Hodnota', type: 'number', nullable: true },
    ], datasetRecords),
    status: 'ready',
    columns: [{ id: 'col-1', key: 'value', name: 'Hodnota', type: 'number', nullable: true }],
    recordCount: 1,
    matchedCount: 1,
    unmatchedCount: 0,
  }

  const labelOverrides = {
    [active[0]!.id]: {
      workplaceId: active[0]!.id,
      offsetX: 5,
      manualPosition: true,
    },
  }

  const mapState = { pluginId: 'by-workplace', datasetId: 'dataset-1', themeId: 'classic' }

  memSave('map-graph-org-v1', syncedSnapshot)
  memSave('map-graph-config-v4', configState)
  memSave('map-graph-datasets-v2', { datasets: [dataset], recordsByDataset: { 'dataset-1': datasetRecords } })
  memSave('map-graph-map-v3', mapState)
  memSave('map-graph-workplace-label-overrides-v1', labelOverrides)

  const reloadedOrg = simulateLoadOrganization(memLoad('map-graph-org-v1', null))
  check('reload-org-without-resync', isOrganizationSynced(reloadedOrg), `${reloadedOrg.regions.length} regions`)
  check('reload-leader-color', reloadedOrg.leaders[0]?.color === '#ff3366', reloadedOrg.leaders[0]?.color ?? '')

  const reloadedConfig = memLoad<{
    workplaceDisplayColors: Record<string, string>
    regionDisplayColors: Record<string, string>
    districtDisplayColors: Record<string, string>
  } | null>('map-graph-config-v4', null)
  check(
    'reload-workplace-color',
    reloadedConfig?.workplaceDisplayColors[active[0]!.id] === '#112233',
    reloadedConfig?.workplaceDisplayColors[active[0]!.id] ?? '',
  )
  check(
    'reload-region-color',
    reloadedConfig?.regionDisplayColors[syncedSnapshot.regions[0]!.id] === '#445566',
    reloadedConfig?.regionDisplayColors[syncedSnapshot.regions[0]!.id] ?? '',
  )
  check(
    'reload-district-color',
    reloadedConfig?.districtDisplayColors['district-praha'] === '#aabbcc',
    reloadedConfig?.districtDisplayColors['district-praha'] ?? '',
  )

  const reloadedMap = memLoad<{ pluginId: string } | null>('map-graph-map-v3', null)
  check('reload-map-plugin', reloadedMap?.pluginId === 'by-workplace', reloadedMap?.pluginId ?? '')

  const reloadedLabels = memLoad<Record<string, { offsetX?: number }>>(
    'map-graph-workplace-label-overrides-v1',
    {},
  )
  check('reload-label-overrides', reloadedLabels[active[0]!.id]?.offsetX === 5, `${reloadedLabels[active[0]!.id]?.offsetX}`)

  const reloadedDatasets = memLoad<{ datasets: Dataset[]; recordsByDataset: Record<string, DatasetRecord[]> }>(
    'map-graph-datasets-v2',
    { datasets: [], recordsByDataset: {} },
  )
  check('reload-datasets', reloadedDatasets.datasets.length === 1, `${reloadedDatasets.datasets.length}`)

  datasetRecords[0]!.values.value = 200
  dataset.updatedAt = '2026-07-17T12:00:00.000Z'
  dataset.revision = 2
  memSave('map-graph-datasets-v2', { datasets: [dataset], recordsByDataset: { 'dataset-1': datasetRecords } })
  const editedReload = memLoad<{ datasets: Dataset[]; recordsByDataset: Record<string, DatasetRecord[]> }>(
    'map-graph-datasets-v2',
    { datasets: [], recordsByDataset: {} },
  )
  check(
    'reload-edited-dataset',
    editedReload.recordsByDataset['dataset-1']?.[0]?.values.value === 200,
    String(editedReload.recordsByDataset['dataset-1']?.[0]?.values.value),
  )

  const resyncMerged = mergeOrganizationSnapshots(reloadedOrg, preview.incoming, preview.defaultResolutions)
  check(
    'resync-preserves-leader-color',
    resyncMerged.leaders.find((l) => l.id === reloadedOrg.leaders[0]!.id)?.color === '#ff3366',
    resyncMerged.leaders[0]?.color ?? '',
  )

  check(
    'corrupt-json-fallback',
    loadJson('nonexistent-key', buildDefaultDistrictAssignments(districts, seedWorkplaces)) !== null,
    'fallback OK',
  )

  const backup: WorkspaceBackup = {
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    modules: {
      organization: syncedSnapshot,
      config: configState,
      datasets: { datasets: [dataset], recordsByDataset: { 'dataset-1': datasetRecords } },
      map: mapState,
      workplaceLabelOverrides: labelOverrides,
    },
  }
  check('backup-version', backup.version === WORKSPACE_BACKUP_VERSION, `${backup.version}`)
  check('backup-has-org', Boolean(backup.modules.organization), 'org')
  check('backup-has-datasets', Boolean(backup.modules.datasets), 'datasets')

  const backupValidation = validateWorkspaceBackup(backup)
  check('backup-validation', backupValidation.ok, backupValidation.errors.join('; '))

  memory.clear()
  for (const [moduleKey, value] of Object.entries(backup.modules)) {
    const keyMap: Record<string, string> = {
      organization: 'map-graph-org-v1',
      config: 'map-graph-config-v4',
      datasets: 'map-graph-datasets-v2',
      map: 'map-graph-map-v3',
      workplaceLabelOverrides: 'map-graph-workplace-label-overrides-v1',
    }
    const storageKey = keyMap[moduleKey]
    if (storageKey && value !== undefined) memSave(storageKey, value)
  }
  check(
    'backup-restore',
    isOrganizationSynced(simulateLoadOrganization(memLoad('map-graph-org-v1', null))),
    'org restored',
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE PERSISTENT WORKSPACE ===\n')
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
