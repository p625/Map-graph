import { useMemo, useState } from 'react'
import type { ColumnType } from '../domain/types/datasetColumn'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import { useConfigData } from '../store/configStore'
import { useDatasetDispatch } from '../store/datasetStore'
import { createId } from '../utils/storage'

interface ManualColumn {
  name: string
  type: ColumnType
}

export function ManualEntryPage() {
  const { workplaces } = useConfigData()
  const dispatch = useDatasetDispatch()
  const [datasetName, setDatasetName] = useState('Ruční zadání')
  const [columns, setColumns] = useState<ManualColumn[]>([
    { name: 'Hodnota', type: 'number' },
  ])
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})

  const datasetColumns = useMemo(
    () =>
      columns.map((column, index) => ({
        id: `col-${index}`,
        key: `column_${index + 1}`,
        name: column.name,
        type: column.type,
        nullable: true,
      })),
    [columns],
  )

  function updateValue(workplaceId: string, columnKey: string, value: string) {
    setValues((current) => ({
      ...current,
      [workplaceId]: {
        ...(current[workplaceId] ?? {}),
        [columnKey]: value,
      },
    }))
  }

  function handleSave() {
    const datasetId = createId('dataset')
    const records: DatasetRecord[] = workplaces.map((workplace, index) => ({
      id: `${datasetId}-record-${index + 1}`,
      datasetId,
      workplaceId: workplace.id,
      matchStatus: 'matched',
      values: Object.fromEntries(
        datasetColumns.map((column) => [
          column.key,
          values[workplace.id]?.[column.key] ?? null,
        ]),
      ),
    }))

    dispatch({
      type: 'add-dataset',
      dataset: {
        id: datasetId,
        name: datasetName,
        source: 'manual',
        importedAt: new Date().toISOString(),
        status: 'ready',
        columns: datasetColumns,
        recordCount: records.length,
        matchedCount: records.length,
        unmatchedCount: 0,
      },
      records,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Ruční zadání</h2>
        <p className="mt-1 text-sm text-slate-600">
          Vytvořte dataset ručně pro všech 65 pracovišť OPŽL.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Název datasetu</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={datasetName}
            onChange={(event) => setDatasetName(event.target.value)}
          />
        </label>
        <div className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Sloupce</span>
          {columns.map((column, index) => (
            <div key={index} className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                value={column.name}
                onChange={(event) =>
                  setColumns((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-2"
                value={column.type}
                onChange={(event) =>
                  setColumns((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, type: event.target.value as ColumnType }
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
            onClick={() => setColumns((current) => [...current, { name: 'Nový sloupec', type: 'number' }])}
          >
            Přidat sloupec
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">Pracoviště</th>
              {datasetColumns.map((column) => (
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
                {datasetColumns.map((column) => (
                  <td key={column.id} className="px-4 py-3">
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1"
                      value={values[workplace.id]?.[column.key] ?? ''}
                      onChange={(event) =>
                        updateValue(workplace.id, column.key, event.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        onClick={handleSave}
      >
        Uložit dataset
      </button>
    </div>
  )
}
