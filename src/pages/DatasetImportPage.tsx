import { useState } from 'react'
import {
  buildImportPreview,
  createDatasetFromPreview,
  type ImportPreview,
} from '../domain/import/ImportPipeline'
import { inferSourceType, parseTableFile } from '../domain/import/fileParser'
import { useConfigData } from '../store/configStore'
import { useDatasetDispatch } from '../store/datasetStore'
import { createId } from '../utils/storage'

export function DatasetImportPage() {
  const { workplaces } = useConfigData()
  const dispatch = useDatasetDispatch()
  const [file, setFile] = useState<File | null>(null)
  const [datasetName, setDatasetName] = useState('')
  const [workplaceColumn, setWorkplaceColumn] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({})

  const [tableHeaders, setTableHeaders] = useState<string[]>([])

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

  function handleImport() {
    if (!preview || !file) return

    const datasetId = createId('dataset')
    const records = preview.records.map((record) => {
      const manualWorkplaceId = manualMatches[record.id]
      if (!manualWorkplaceId) return { ...record, datasetId }
      return {
        ...record,
        datasetId,
        workplaceId: manualWorkplaceId,
        matchStatus: 'manual' as const,
      }
    })

    const matchedCount = records.filter((record) => record.workplaceId).length
    const finalPreview: ImportPreview = {
      ...preview,
      records,
      matchedCount,
      unmatchedCount: records.length - matchedCount,
    }

    const dataset = createDatasetFromPreview(finalPreview, {
      id: datasetId,
      name: datasetName || file.name,
      source: inferSourceType(file.name),
      sourceFileName: file.name,
    })

    dispatch({ type: 'add-dataset', dataset, records })
    setPreview(null)
    setFile(null)
    setDatasetName('')
    setManualMatches({})
  }

  const unmatchedRecords = preview?.records.filter((record) => !record.workplaceId) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Import datasetu</h2>
        <p className="mt-1 text-sm text-slate-600">
          Importujte libovolný tabulkový soubor a napárujte řádky na pracoviště OPŽL.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Soubor</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="mt-2 block w-full text-sm"
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {preview && (
        <div className="space-y-6">
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Název datasetu</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={datasetName}
                onChange={(event) => setDatasetName(event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Sloupec pracoviště</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={workplaceColumn ?? ''}
                onChange={(event) => {
                  const value = event.target.value || null
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
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Detekované sloupce</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {preview.columns.map((column) => (
                <li key={column.id}>
                  {column.name} <span className="text-slate-500">({column.type})</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              Párování: {preview.matchedCount}/{preview.records.length} spárováno
            </p>
          </div>

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
                      onChange={(event) =>
                        setManualMatches((current) => ({
                          ...current,
                          [record.id]: event.target.value,
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

          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleImport}
          >
            Importovat dataset
          </button>
        </div>
      )}
    </div>
  )
}
