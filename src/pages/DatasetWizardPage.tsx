import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnType } from '../domain/types/datasetColumn'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import { computeDatasetHealth, summarizeColumns } from '../domain/dataset/datasetHealth'
import { datasetStatusLabel } from '../domain/dataset/datasetValidation'
import {
  buildImportPreview,
  createDatasetFromPreview,
  type ImportPreview,
} from '../domain/import/ImportPipeline'
import { inferSourceType, parseTableFile } from '../domain/import/fileParser'
import { useConfigData } from '../store/configStore'
import { useDatasetDispatch } from '../store/datasetStore'
import { useMapActions } from '../store/mapStore'
import { useNotifications } from '../store/notificationStore'
import { createId } from '../utils/storage'

type WizardStep = 1 | 2 | 3
type ImportMode = 'file' | 'manual'

interface ManualColumn {
  name: string
  type: ColumnType
}

const steps = [
  { num: 1, label: 'Import' },
  { num: 2, label: 'Kontrola / Oprava' },
  { num: 3, label: 'Dokončení' },
]

export function DatasetWizardPage() {
  const navigate = useNavigate()
  const { workplaces } = useConfigData()
  const dispatch = useDatasetDispatch()
  const { setDataset } = useMapActions()
  const { notify } = useNotifications()

  const [step, setStep] = useState<WizardStep>(1)
  const [mode, setMode] = useState<ImportMode>('file')

  // File import state
  const [file, setFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [workplaceColumn, setWorkplaceColumn] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [tableHeaders, setTableHeaders] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({})

  // Manual entry state
  const [manualColumns, setManualColumns] = useState<ManualColumn[]>([
    { name: 'Hodnota', type: 'number' },
  ])
  const [manualValues, setManualValues] = useState<Record<string, Record<string, string>>>({})

  const manualDatasetColumns = useMemo(
    () =>
      manualColumns.map((column, index) => ({
        id: `col-${index}`,
        key: `column_${index + 1}`,
        name: column.name,
        type: column.type,
        nullable: true,
      })),
    [manualColumns],
  )

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    setPreview(null)
    setError(null)
    setManualMatches({})
    if (!nextFile) return

    try {
      const table = await parseTableFile(nextFile)
      setTableHeaders(table.headers)
      const datasetId = createId('dataset')
      const importPreview = buildImportPreview(table, workplaces, datasetId, workplaceColumn)
      setPreview(importPreview)
      setWorkplaceColumn(importPreview.workplaceColumn)
      setDatasetName(nextFile.name.replace(/\.[^.]+$/, ''))
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import selhal.')
    }
  }

  async function rebuildPreview(selectedColumn: string | null) {
    if (!file) return
    const table = await parseTableFile(file)
    const datasetId = createId('dataset')
    const importPreview = buildImportPreview(table, workplaces, datasetId, selectedColumn)
    setPreview(importPreview)
    setWorkplaceColumn(importPreview.workplaceColumn)
  }

  function buildManualPreview(): ImportPreview {
    const datasetId = createId('dataset')
    const records: DatasetRecord[] = workplaces.map((workplace, index) => ({
      id: `${datasetId}-record-${index + 1}`,
      datasetId,
      workplaceId: workplace.id,
      matchStatus: 'matched',
      values: Object.fromEntries(
        manualDatasetColumns.map((column) => [
          column.key,
          manualValues[workplace.id]?.[column.key] ?? null,
        ]),
      ),
    }))

    return {
      workplaceColumn: null,
      columns: manualDatasetColumns,
      records,
      matchedCount: records.length,
      unmatchedCount: 0,
    }
  }

  function getActivePreview(): ImportPreview | null {
    if (mode === 'manual') return buildManualPreview()
    if (!preview) return null

    const records = preview.records.map((record) => {
      const manualWorkplaceId = manualMatches[record.id]
      if (!manualWorkplaceId) return record
      return {
        ...record,
        workplaceId: manualWorkplaceId,
        matchStatus: 'manual' as const,
      }
    })
    const matchedCount = records.filter((r) => r.workplaceId).length
    return {
      ...preview,
      records,
      matchedCount,
      unmatchedCount: records.length - matchedCount,
    }
  }

  const activePreview = getActivePreview()
  const health = activePreview
    ? computeDatasetHealth({
        id: 'preview',
        name: datasetName,
        recordCount: activePreview.records.length,
        matchedCount: activePreview.matchedCount,
        unmatchedCount: activePreview.unmatchedCount,
        columns: activePreview.columns,
      })
    : null

  function canProceedFromStep1(): boolean {
    if (mode === 'manual') return datasetName.trim().length > 0
    return preview !== null && datasetName.trim().length > 0
  }

  function handleFinish() {
    if (!activePreview) return

    const datasetId = createId('dataset')
    const records = activePreview.records.map((record) => ({
      ...record,
      id: record.id.replace(/^dataset-[^-]+/, datasetId),
      datasetId,
    }))

    const finalPreview: ImportPreview = {
      ...activePreview,
      records,
      matchedCount: records.filter((r) => r.workplaceId).length,
      unmatchedCount: records.filter((r) => !r.workplaceId).length,
    }

    const dataset = createDatasetFromPreview(finalPreview, {
      id: datasetId,
      name: datasetName,
      source: mode === 'manual' ? 'manual' : file ? inferSourceType(file.name) : 'other',
      sourceFileName: file?.name,
    })

    const readyDataset = {
      ...dataset,
      status: health?.canProceedToMap ? ('ready' as const) : dataset.status,
    }

    dispatch({ type: 'add-dataset', dataset: readyDataset, records })
    setDataset(datasetId)

    notify({
      type: health?.canProceedToMap ? 'success' : 'warning',
      title: 'Dataset importován',
      message: `„${datasetName}" — ${records.length} řádků, stav: ${datasetStatusLabel(readyDataset.status)}`,
    })

    navigate('/datasets')
  }

  const unmatchedRecords = activePreview?.records.filter((r) => !r.workplaceId) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Import datasetu</h2>
        <p className="mt-1 text-sm text-slate-600">
          Třístupňový wizard: import → kontrola → dokončení.
        </p>
      </div>

      <nav className="flex gap-2">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              step === s.num
                ? 'bg-blue-600 text-white'
                : step > s.num
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
              {s.num}
            </span>
            {s.label}
          </div>
        ))}
      </nav>

      {step === 1 && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'file' ? 'bg-blue-600 text-white' : 'border border-slate-300'
              }`}
              onClick={() => setMode('file')}
            >
              Soubor (Excel/CSV)
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'manual' ? 'bg-blue-600 text-white' : 'border border-slate-300'
              }`}
              onClick={() => setMode('manual')}
            >
              Ruční zadání
            </button>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Název datasetu</span>
            <input
              className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
            />
          </label>

          {mode === 'file' ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-slate-700">Soubor</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2 block w-full text-sm"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              {preview && (
                <p className="mt-3 text-sm text-green-700">
                  Načteno {preview.records.length} řádků, {preview.columns.length} sloupců
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Sloupce</span>
                {manualColumns.map((column, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={column.name}
                      onChange={(e) =>
                        setManualColumns((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, name: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={column.type}
                      onChange={(e) =>
                        setManualColumns((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, type: e.target.value as ColumnType }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="number">number</option>
                      <option value="percent">percent</option>
                      <option value="text">text</option>
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() =>
                    setManualColumns((c) => [...c, { name: 'Nový sloupec', type: 'number' }])
                  }
                >
                  Přidat sloupec
                </button>
              </div>
              <p className="text-sm text-slate-600">
                Ruční zadání vytvoří {workplaces.length} řádků (po jednom pro každé pracoviště).
                Hodnoty vyplníte v kroku 2.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!canProceedFromStep1()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            onClick={() => setStep(2)}
          >
            Pokračovat
          </button>
        </div>
      )}

      {step === 2 && activePreview && (
        <div className="space-y-6">
          {mode === 'file' && (
            <label className="block max-w-md space-y-1 text-sm">
              <span className="font-medium text-slate-700">Sloupec pracoviště</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={workplaceColumn ?? ''}
                onChange={(e) => {
                  const value = e.target.value || null
                  setWorkplaceColumn(value)
                  void rebuildPreview(value)
                }}
              >
                {tableHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Detekované sloupce</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {activePreview.columns.map((column) => (
                <li key={column.id}>
                  {column.name} <span className="text-slate-500">({column.type})</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-600">
              Párování: {activePreview.matchedCount}/{activePreview.records.length} spárováno
            </p>
          </div>

          {mode === 'manual' && (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-700">Pracoviště</th>
                    {manualDatasetColumns.map((column) => (
                      <th key={column.id} className="px-4 py-3 font-medium text-slate-700">
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workplaces.map((workplace) => (
                    <tr key={workplace.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{workplace.name}</td>
                      {manualDatasetColumns.map((column) => (
                        <td key={column.id} className="px-4 py-3">
                          <input
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                            value={manualValues[workplace.id]?.[column.key] ?? ''}
                            onChange={(e) =>
                              setManualValues((current) => ({
                                ...current,
                                [workplace.id]: {
                                  ...(current[workplace.id] ?? {}),
                                  [column.key]: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unmatchedRecords.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-sm font-semibold text-amber-900">
                Nespárované řádky ({unmatchedRecords.length})
              </h3>
              <div className="mt-4 space-y-3">
                {unmatchedRecords.map((record) => (
                  <div key={record.id} className="grid gap-3 md:grid-cols-[1fr_240px]">
                    <div className="text-sm text-amber-900">{record.rawLabel ?? '—'}</div>
                    <select
                      className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
                      value={manualMatches[record.id] ?? ''}
                      onChange={(e) =>
                        setManualMatches((current) => ({
                          ...current,
                          [record.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Vyberte pracoviště</option>
                      {workplaces.map((workplace) => (
                        <option key={workplace.id} value={workplace.id}>
                          {workplace.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(1)}
            >
              Zpět
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setStep(3)}
            >
              Pokračovat
            </button>
          </div>
        </div>
      )}

      {step === 3 && health && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Shrnutí datasetu</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Název</dt>
                <dd className="font-medium">{datasetName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Řádky</dt>
                <dd className="font-medium">{health.rowsTotal}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Spárováno</dt>
                <dd className="font-medium">
                  {health.rowsMatched}/{health.rowsTotal}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Sloupce</dt>
                <dd className="font-medium">
                  {activePreview ? summarizeColumns(activePreview.columns) : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Skóre zdraví</dt>
                <dd className="font-medium">{health.overallScore}%</dd>
              </div>
            </dl>

            {health.issues.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {health.issues.map((issue) => (
                  <li
                    key={issue.code}
                    className={
                      issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'
                    }
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}

            {!health.canProceedToMap && (
              <p className="mt-4 text-sm text-amber-700">
                Dataset lze uložit, ale datové vizualizace na mapě budou deaktivovány, dokud nebudou
                všechny problémy vyřešeny.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep(2)}
            >
              Zpět
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={handleFinish}
            >
              Dokončit import
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
