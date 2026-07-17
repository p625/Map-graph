import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  formatCellValue,
  parseEditedCellValue,
  validateDatasetEditorState,
} from '../domain/dataset/datasetEditorValidation'
import { cloneDatasetColumns, cloneDatasetRecords } from '../domain/dataset/datasetSnapshot'
import { datasetStatusLabel } from '../domain/dataset/datasetValidation'
import type { DatasetColumn } from '../domain/types/datasetColumn'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import { useConfigData } from '../store/configStore'
import {
  useDatasetActions,
  useDatasetState,
} from '../store/datasetStore'
import { useNotifications } from '../store/notificationStore'
import { createId } from '../utils/storage'

interface EditorDraft {
  name: string
  columns: DatasetColumn[]
  records: DatasetRecord[]
}

function buildDraft(
  name: string,
  columns: DatasetColumn[],
  records: DatasetRecord[],
): EditorDraft {
  return {
    name,
    columns: cloneDatasetColumns(columns),
    records: cloneDatasetRecords(records),
  }
}

export function DatasetEditorPage() {
  const { datasetId = '' } = useParams()
  const navigate = useNavigate()
  const { datasets, recordsByDataset } = useDatasetState()
  const { saveDatasetEdits, restoreDatasetImport } = useDatasetActions()
  const { workplaces } = useConfigData()
  const { notify } = useNotifications()

  const dataset = datasets.find((item) => item.id === datasetId) ?? null
  const persistedRecords = dataset ? recordsByDataset[dataset.id] ?? [] : []

  const [draft, setDraft] = useState<EditorDraft | null>(() =>
    dataset ? buildDraft(dataset.name, dataset.columns, persistedRecords) : null,
  )
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())

  const visibleRecords = useMemo(
    () => (draft ? draft.records.filter((record) => !pendingDeleteIds.has(record.id)) : []),
    [draft, pendingDeleteIds],
  )

  const validation = useMemo(() => {
    if (!draft) return null
    return validateDatasetEditorState({
      name: draft.name,
      columns: draft.columns,
      records: visibleRecords,
      workplaces,
    })
  }, [draft, visibleRecords, workplaces])

  if (!dataset || !draft) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Dataset nebyl nalezen.</p>
        <Link to="/datasets" className="text-sm text-blue-600 hover:underline">
          Zpět na seznam
        </Link>
      </div>
    )
  }

  function updateCell(recordId: string, columnKey: string, raw: string) {
    const column = draft!.columns.find((item) => item.key === columnKey)
    if (!column) return
    const parsed = parseEditedCellValue(raw, column.type)
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        records: current.records.map((record) =>
          record.id === recordId
            ? { ...record, values: { ...record.values, [columnKey]: parsed.value } }
            : record,
        ),
      }
    })
  }

  function updateWorkplace(recordId: string, workplaceId: string) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        records: current.records.map((record) =>
          record.id === recordId
            ? {
                ...record,
                workplaceId: workplaceId || null,
                matchStatus: workplaceId ? ('manual' as const) : ('unmatched' as const),
              }
            : record,
        ),
      }
    })
  }

  function updateColumnName(columnId: string, name: string) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        columns: current.columns.map((column) =>
          column.id === columnId ? { ...column, name } : column,
        ),
      }
    })
  }

  function handleAddRow() {
    const newRecord: DatasetRecord = {
      id: createId(`${dataset!.id}-record`),
      datasetId: dataset!.id,
      workplaceId: null,
      matchStatus: 'unmatched',
      values: Object.fromEntries(draft!.columns.map((column) => [column.key, null])),
    }
    setDraft((current) => (current ? { ...current, records: [...current.records, newRecord] } : current))
  }

  function handleDeleteRow(recordId: string) {
    if (!confirm('Odstranit tento řádek? Změna se projeví až po uložení.')) return
    setPendingDeleteIds((current) => new Set([...current, recordId]))
  }

  function handleCancel() {
    setDraft(buildDraft(dataset!.name, dataset!.columns, persistedRecords))
    setPendingDeleteIds(new Set())
  }

  function handleSave(forceWarnings = false) {
    const result = validateDatasetEditorState({
      name: draft!.name.trim(),
      columns: draft!.columns,
      records: visibleRecords,
      workplaces,
    })
    if (result.blocking) return
    if (!forceWarnings && result.issues.some((issue) => issue.severity === 'warning')) {
      if (!confirm('Dataset obsahuje varování. Uložit přesto?')) return
    }

    saveDatasetEdits({
      datasetId: dataset!.id,
      name: draft!.name.trim(),
      columns: draft!.columns,
      records: visibleRecords,
    })
    setPendingDeleteIds(new Set())
    notify({
      type: 'success',
      title: 'Dataset uložen',
      message: `„${draft!.name.trim()}" byl aktualizován.`,
    })
  }

  function handleRestoreImport() {
    if (!dataset!.importSnapshot) return
    if (!confirm('Obnovit původní import? Všechny ruční úpravy budou ztraceny.')) return
    restoreDatasetImport(dataset!.id)
    const snapshot = dataset!.importSnapshot
    setDraft(buildDraft(snapshot.name, snapshot.columns, snapshot.records))
    setPendingDeleteIds(new Set())
    notify({
      type: 'info',
      title: 'Import obnoven',
      message: 'Dataset byl vrácen do stavu po původním importu.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/datasets" className="text-sm text-blue-600 hover:underline">
            ← Datasety
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Upravit data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tabulkový editor importovaných hodnot. Změny se projeví až po uložení.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            onClick={() => navigate('/datasets')}
          >
            Zavřít
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            onClick={handleCancel}
          >
            Zrušit
          </button>
          {dataset.importSnapshot && (
            <button
              type="button"
              className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900"
              onClick={handleRestoreImport}
            >
              Obnovit původní import
            </button>
          )}
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={validation?.blocking}
            onClick={() => handleSave()}
          >
            Uložit
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Název datasetu</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <div className="text-sm">
          <p className="font-medium text-slate-700">Import</p>
          <p className="text-slate-600">{new Date(dataset.importedAt).toLocaleString('cs-CZ')}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-slate-700">Poslední změna</p>
          <p className="text-slate-600">{new Date(dataset.updatedAt ?? dataset.importedAt).toLocaleString('cs-CZ')}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-slate-700">Stav</p>
          <p className="text-slate-600">
            {datasetStatusLabel(dataset.status)} · revize {dataset.revision ?? 1} · {visibleRecords.length}{' '}
            řádků
          </p>
        </div>
      </div>

      {validation && validation.issues.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Validace</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {validation.issues.map((issue, index) => (
              <li
                key={`${issue.code}-${issue.recordId ?? index}`}
                className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-700">Pracoviště</th>
              {draft.columns.map((column) => (
                <th key={column.id} className="px-3 py-2 font-medium text-slate-700">
                  <input
                    className="w-full min-w-[8rem] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-300"
                    value={column.name}
                    onChange={(event) => updateColumnName(column.id, event.target.value)}
                  />
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => (
              <tr key={record.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <select
                    className="w-full min-w-[10rem] rounded-md border border-slate-300 px-2 py-1"
                    value={record.workplaceId ?? ''}
                    onChange={(event) => updateWorkplace(record.id, event.target.value)}
                  >
                    <option value="">— nevybráno —</option>
                    {workplaces.map((workplace) => (
                      <option key={workplace.id} value={workplace.id}>
                        {workplace.name}
                      </option>
                    ))}
                  </select>
                </td>
                {draft.columns.map((column) => (
                  <td key={column.id} className="px-3 py-2">
                    <input
                      className="w-full min-w-[6rem] rounded-md border border-slate-300 px-2 py-1"
                      value={formatCellValue(record.values[column.key])}
                      onChange={(event) => updateCell(record.id, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => handleDeleteRow(record.id)}
                  >
                    Odstranit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        onClick={handleAddRow}
      >
        + Přidat řádek
      </button>
    </div>
  )
}
