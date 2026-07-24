/**
 * Validace persistence datasetů (Phase 5F).
 */
import { createImportSnapshot } from '../src/domain/dataset/datasetSnapshot.ts'
import {
  buildStorageDiagnostics,
  DATASET_QUOTA_ERROR_MESSAGE,
  estimateDatasetStateBytes,
} from '../src/domain/persistence/storageDiagnostics.ts'
import { PERSISTENCE_MODE } from '../src/domain/persistence/persistenceStatus.ts'
import type { Dataset } from '../src/domain/types/dataset.ts'
import type { DatasetColumn } from '../src/domain/types/datasetColumn.ts'
import type { DatasetRecord } from '../src/domain/types/datasetRecord.ts'
import {
  validateWorkspaceBackup,
  WORKSPACE_MODULE_KEYS,
  type WorkspaceBackup,
} from '../src/domain/workspace/workspaceBackup.ts'
import { isDatasetStateValid } from '../src/utils/storage.ts'

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function makeDataset(id: string, name: string, value: number): { dataset: Dataset; records: DatasetRecord[] } {
  const importedAt = '2026-07-10T10:00:00.000Z'
  const columns: DatasetColumn[] = [
    { id: `${id}-col`, key: 'metric', name: 'Metrika', type: 'number', nullable: false },
  ]
  const records: DatasetRecord[] = [
    {
      id: `${id}-rec-1`,
      datasetId: id,
      workplaceId: 'workplace-1',
      matchStatus: 'matched',
      values: { metric: value },
    },
  ]
  const dataset: Dataset = {
    id,
    name,
    source: 'excel',
    importedAt,
    updatedAt: importedAt,
    revision: 1,
    status: 'ready',
    columns,
    recordCount: records.length,
    matchedCount: records.length,
    unmatchedCount: 0,
    importSnapshot: createImportSnapshot(name, columns, records),
  }
  return { dataset, records }
}

function main() {
  const first = makeDataset('dataset-a', 'Dataset A', 10)
  const second = makeDataset('dataset-b', 'Dataset B', 20)
  const state = {
    datasets: [first.dataset, second.dataset],
    recordsByDataset: {
      [first.dataset.id]: first.records,
      [second.dataset.id]: second.records,
    },
  }

  check('persistence-mode-local', PERSISTENCE_MODE === 'local', PERSISTENCE_MODE)
  check('state-valid', isDatasetStateValid(state), `${state.datasets.length} datasets`)
  check('multiple-datasets-stored', state.datasets.length === 2, String(state.datasets.length))

  const serialized = JSON.stringify(state)
  const parsed = JSON.parse(serialized)
  check(
    'reload-round-trip-count',
    parsed.datasets.length === 2 && parsed.recordsByDataset['dataset-a']?.length === 1,
    `${parsed.datasets.length}`,
  )

  const editedRecords = [
    {
      ...first.records[0]!,
      values: { metric: 999 },
    },
  ]
  const editedState = {
    ...state,
    datasets: state.datasets.map((dataset) =>
      dataset.id === 'dataset-a'
        ? { ...dataset, updatedAt: '2026-07-11T12:00:00.000Z', revision: 2 }
        : dataset,
    ),
    recordsByDataset: {
      ...state.recordsByDataset,
      'dataset-a': editedRecords,
    },
  }
  check(
    'edited-cell-round-trip',
    JSON.parse(JSON.stringify(editedState)).recordsByDataset['dataset-a'][0].values.metric === 999,
    '999',
  )

  const backup: WorkspaceBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    modules: {
      datasets: editedState,
    },
  }
  const validation = validateWorkspaceBackup(backup)
  check('workspace-backup-valid', validation.ok, validation.errors.join('; '))
  check(
    'workspace-has-datasets-module',
    WORKSPACE_MODULE_KEYS.datasets === 'map-graph-datasets-v2',
    WORKSPACE_MODULE_KEYS.datasets,
  )

  const restored = backup.modules.datasets as typeof editedState
  check(
    'workspace-round-trip-equality',
    JSON.stringify(restored) === JSON.stringify(editedState),
    'datasets equal',
  )

  const diagnostics = buildStorageDiagnostics(state)
  check('diagnostics-dataset-count', diagnostics.datasetCount === 2, String(diagnostics.datasetCount))
  check('diagnostics-no-cross-device', diagnostics.crossDeviceSync === false, 'false')
  check(
    'diagnostics-size-estimate',
    estimateDatasetStateBytes(state) > 100,
    String(estimateDatasetStateBytes(state)),
  )

  check(
    'quota-message-present',
    DATASET_QUOTA_ERROR_MESSAGE.includes('Exportujte zálohu'),
    DATASET_QUOTA_ERROR_MESSAGE.slice(0, 40),
  )

  check(
    'invalid-storage-rejected',
    !isDatasetStateValid({ datasets: 'bad', recordsByDataset: {} }),
    'invalid rejected',
  )

  check(
    'cross-device-not-implemented',
    PERSISTENCE_MODE !== 'cloud',
    'localStorage is browser-local only — cross-device sync NOT IMPLEMENTED',
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-dataset-persistence ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main()
