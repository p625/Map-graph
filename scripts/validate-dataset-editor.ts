/**
 * Validace editoru datasetů (Phase 5C.9).
 */
import { createImportSnapshot } from '../src/domain/dataset/datasetSnapshot.ts'
import {
  parseEditedCellValue,
  validateDatasetEditorState,
} from '../src/domain/dataset/datasetEditorValidation.ts'
import { resolveReadyStatus } from '../src/domain/dataset/datasetValidation.ts'
import type { Dataset } from '../src/domain/types/dataset.ts'
import type { DatasetColumn } from '../src/domain/types/datasetColumn.ts'
import type { DatasetRecord } from '../src/domain/types/datasetRecord.ts'

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

const workplaces = [
  { id: 'wp-a', code: 'A', name: 'Praha' },
  { id: 'wp-b', code: 'B', name: 'Brno' },
]

const columns = [
  { id: 'col-1', key: 'value', name: 'Hodnota', type: 'number' as const, nullable: true },
  { id: 'col-2', key: 'note', name: 'Poznámka', type: 'text' as const, nullable: true },
]

function makeRecord(
  id: string,
  workplaceId: string | null,
  values: Record<string, unknown>,
): DatasetRecord {
  return {
    id,
    datasetId: 'dataset-test',
    workplaceId,
    matchStatus: workplaceId ? 'matched' : 'unmatched',
    values,
  }
}

function simulateSave(
  dataset: Dataset,
  records: DatasetRecord[],
  patch: { name?: string; columns?: DatasetColumn[]; records?: DatasetRecord[] },
): { dataset: Dataset; records: DatasetRecord[] } {
  const nextRecords = (patch.records ?? records).map((record) => ({ ...record, datasetId: dataset.id }))
  const matchedCount = nextRecords.filter((record) => record.workplaceId).length
  const nextDataset: Dataset = {
    ...dataset,
    name: patch.name ?? dataset.name,
    columns: patch.columns ?? dataset.columns,
    recordCount: nextRecords.length,
    matchedCount,
    unmatchedCount: nextRecords.length - matchedCount,
    revision: (dataset.revision ?? 1) + 1,
    updatedAt: '2026-07-17T12:00:00.000Z',
    status: resolveReadyStatus(matchedCount, nextRecords.length, (patch.columns ?? dataset.columns).length),
  }
  return { dataset: nextDataset, records: nextRecords }
}

function main() {
  const importedAt = '2026-07-10T10:00:00.000Z'
  const initialRecords = [
    makeRecord('r1', 'wp-a', { value: 10, note: 'A' }),
    makeRecord('r2', 'wp-b', { value: 0, note: null }),
  ]

  let dataset: Dataset = {
    id: 'dataset-test',
    name: 'Test dataset',
    source: 'excel',
    importedAt,
    updatedAt: importedAt,
    revision: 1,
    importSnapshot: createImportSnapshot('Test dataset', columns, initialRecords),
    status: 'ready',
    columns,
    recordCount: 2,
    matchedCount: 2,
    unmatchedCount: 0,
  }
  let records = [...initialRecords]

  check('open-dataset', dataset.id === 'dataset-test', dataset.name)

  const textEdit = parseEditedCellValue('Nový text', 'text')
  check('edit-text', textEdit.value === 'Nový text', String(textEdit.value))

  const numberEdit = parseEditedCellValue('42,5', 'number')
  check('edit-number', numberEdit.value === 42.5, String(numberEdit.value))

  const zeroEdit = parseEditedCellValue('0', 'number')
  check('zero-stays-zero', zeroEdit.value === 0, String(zeroEdit.value))

  const emptyEdit = parseEditedCellValue('', 'number')
  check('empty-stays-empty', emptyEdit.value === null, String(emptyEdit.value))

  const invalidNumber = parseEditedCellValue('abc', 'number')
  check('invalid-number-blocked', Boolean(invalidNumber.error), invalidNumber.error ?? '')

  const editedRecords = records.map((record) =>
    record.id === 'r1'
      ? { ...record, values: { ...record.values, note: 'Upraveno\nřádek' } }
      : record,
  )
  const validationBeforeSave = validateDatasetEditorState({
    name: dataset.name,
    columns,
    records: editedRecords,
    workplaces,
  })
  check('validation-before-save-ok', !validationBeforeSave.blocking, `${validationBeforeSave.issues.length} issues`)

  const saved = simulateSave(dataset, records, { records: editedRecords })
  dataset = saved.dataset
  records = saved.records
  check('save-updates-revision', dataset.revision === 2, `rev=${dataset.revision}`)
  check('save-updates-text', records[0]?.values.note === 'Upraveno\nřádek', String(records[0]?.values.note))

  const withNewRow = [
    ...records,
    makeRecord('r3', 'wp-a', { value: null, note: 'dup' }),
  ]
  const dupValidation = validateDatasetEditorState({
    name: dataset.name,
    columns,
    records: withNewRow,
    workplaces,
  })
  check('duplicate-workplace-warning', dupValidation.issues.some((i) => i.code === 'duplicate_workplace'), 'warning')

  const withoutWorkplace = [makeRecord('bad', null, { value: 1, note: null })]
  const blockingValidation = validateDatasetEditorState({
    name: dataset.name,
    columns,
    records: withoutWorkplace,
    workplaces,
  })
  check('blocking-without-workplace', blockingValidation.blocking, `${blockingValidation.issues.length}`)

  const deletedRecords = records.filter((record) => record.id !== 'r2')
  const afterDelete = simulateSave(dataset, records, { records: deletedRecords })
  check('delete-row', afterDelete.records.length === 1, `${afterDelete.records.length}`)

  const restoredRecords = dataset.importSnapshot!.records.map((record) => ({ ...record }))
  const restored = simulateSave(afterDelete.dataset, afterDelete.records, {
    name: dataset.importSnapshot!.name,
    columns: dataset.importSnapshot!.columns,
    records: restoredRecords,
  })
  check('restore-import', restored.records.length === 2, `${restored.records.length}`)
  check('restore-revision', restored.dataset.revision === 4, `rev=${restored.dataset.revision}`)

  const persisted = JSON.parse(JSON.stringify({ dataset: restored.dataset, records: restored.records }))
  check('reload-roundtrip', persisted.dataset.revision === 4, `${persisted.dataset.revision}`)

  const mapValue = restored.records.find((record) => record.workplaceId === 'wp-a')?.values.value
  check('map-data-updated', mapValue === 10, String(mapValue))

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE DATASET EDITORU ===\n')
  for (const item of checks) {
    console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.id}: ${item.detail}`)
  }
  console.log(`\nVÝSLEDEK: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${checks.length})`)
  if (failed.length > 0) process.exit(1)
}

main()
