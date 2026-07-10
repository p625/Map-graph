import { useMemo, useState } from 'react'
import { ColorInput } from '../components/config/ColorInput'
import { ConfigToolbar } from '../components/config/ConfigToolbar'
import {
  defaultDistrictColor,
  resolveDistrictDisplayColor,
} from '../domain/color/districtDisplayColors'
import { useConfigData, useConfigDispatch, useConfigState } from '../store/configStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigDistrictColorsPage() {
  const { districts } = useConfigData()
  const { districtDisplayColors } = useConfigState()
  const dispatch = useConfigDispatch()
  const { notify } = useNotifications()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return districts
    return districts.filter((district) => district.name.toLowerCase().includes(normalized))
  }, [districts, query])

  function handleColorChange(districtId: string, districtName: string, color: string) {
    dispatch({ type: 'set-district-color', districtId, color })
    notify({
      type: 'info',
      title: 'Barva okresu',
      message: `${districtName}: ${color}`,
    })
  }

  function handleReset(districtId: string, districtName: string) {
    dispatch({ type: 'reset-district-color', districtId })
    notify({
      type: 'info',
      title: 'Barva resetována',
      message: `${districtName} — výchozí paleta`,
    })
  }

  function handleResetAll() {
    dispatch({ type: 'reset-all-district-colors' })
    notify({
      type: 'success',
      title: 'Barvy resetovány',
      message: 'Všechny okresy používají výchozí paletu.',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Barvy okresů</h2>
          <p className="mt-1 text-sm text-slate-600">
            Barvy se používají pouze v mapovém režimu „Podle okresů“. Ostatní režimy je
            neovlivní.
          </p>
        </div>
        <ConfigToolbar />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[240px] flex-1 space-y-1 text-sm">
          <span className="font-medium text-slate-700">Vyhledávání</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={query}
            placeholder="Název okresu…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={handleResetAll}
        >
          Reset všech na výchozí paletu
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Okres</th>
              <th className="px-4 py-3">Barva</th>
              <th className="px-4 py-3">Zdroj</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((district) => {
              const hasCustom = Boolean(districtDisplayColors[district.id])
              const resolved = resolveDistrictDisplayColor(
                district.id,
                district.name,
                districtDisplayColors,
              )
              const defaultColor = defaultDistrictColor(district.id, district.name)

              return (
                <tr key={district.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{district.name}</td>
                  <td className="px-4 py-3">
                    <ColorInput
                      value={hasCustom ? districtDisplayColors[district.id]! : resolved}
                      onChange={(color) => handleColorChange(district.id, district.name, color)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {hasCustom ? 'Vlastní' : `Výchozí (${defaultColor})`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasCustom && (
                      <button
                        type="button"
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => handleReset(district.id, district.name)}
                      >
                        Reset
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
