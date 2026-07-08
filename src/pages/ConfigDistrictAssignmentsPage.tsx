import { districts } from '../data/seed/districts'
import { ConfigToolbar } from '../components/config/ConfigToolbar'
import { useConfigData, useConfigDispatch, useConfigState } from '../store/configStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigDistrictAssignmentsPage() {
  const { workplaces } = useConfigData()
  const { districtWorkplaceAssignments } = useConfigState()
  const dispatch = useConfigDispatch()
  const { notify } = useNotifications()

  function handleAssignmentChange(districtId: string, workplaceId: string | null) {
    dispatch({ type: 'set-district-workplace', districtId, workplaceId })
    const district = districts.find((d) => d.id === districtId)
    const workplace = workplaces.find((w) => w.id === workplaceId)
    notify({
      type: 'info',
      title: 'Změna konfigurace',
      message: `${district?.name ?? districtId} → ${workplace?.name ?? 'nevybráno'}`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Okresy → Pracoviště</h2>
          <p className="mt-1 text-sm text-slate-600">
            Přiřaďte každý okres k pracovišti OPŽL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConfigToolbar />
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onClick={() => {
              dispatch({ type: 'reset-default-assignments' })
              notify({
                type: 'info',
                title: 'Konfigurace obnovena',
                message: 'Párování okresů bylo resetováno na výchozí hodnoty.',
              })
            }}
          >
            Obnovit párování podle názvu
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">Okres</th>
              <th className="px-4 py-3 font-medium text-slate-700">Pracoviště</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((district) => (
              <tr key={district.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{district.name}</td>
                <td className="px-4 py-3">
                  <select
                    className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2"
                    value={districtWorkplaceAssignments[district.id] ?? ''}
                    onChange={(event) =>
                      handleAssignmentChange(district.id, event.target.value || null)
                    }
                  >
                    <option value="">—</option>
                    {workplaces.map((workplace) => (
                      <option key={workplace.id} value={workplace.id}>
                        {workplace.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
