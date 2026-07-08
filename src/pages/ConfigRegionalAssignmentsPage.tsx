import { ConfigToolbar } from '../components/config/ConfigToolbar'
import { useConfigData, useConfigDispatch, useConfigState } from '../store/configStore'
import { useNotifications } from '../store/notificationStore'

export function ConfigRegionalAssignmentsPage() {
  const { workplaces, regionalOffices } = useConfigData()
  const { workplaceRegionalAssignments } = useConfigState()
  const dispatch = useConfigDispatch()
  const { notify } = useNotifications()

  function handleAssignmentChange(workplaceId: string, regionalOfficeId: string | null) {
    dispatch({ type: 'set-workplace-regional', workplaceId, regionalOfficeId })
    const workplace = workplaces.find((w) => w.id === workplaceId)
    const office = regionalOffices.find((o) => o.id === regionalOfficeId)
    notify({
      type: 'info',
      title: 'Změna konfigurace',
      message: `${workplace?.name ?? workplaceId} → ${office?.name ?? 'nevybráno'}`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Pracoviště → Regionální odbory</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ručně přiřaďte pracoviště pod regionální odbory.
          </p>
        </div>
        <ConfigToolbar />
      </div>

      {regionalOffices.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seznam regionálních odborů zatím není naimportován. Přidejte druhý list do
          `data/raw/workplaces.xlsx` a spusťte `npm run import-seed`.
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">Pracoviště</th>
              <th className="px-4 py-3 font-medium text-slate-700">Regionální odbor</th>
            </tr>
          </thead>
          <tbody>
            {workplaces.map((workplace) => (
              <tr key={workplace.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{workplace.name}</td>
                <td className="px-4 py-3">
                  <select
                    className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2"
                    value={workplaceRegionalAssignments[workplace.id] ?? ''}
                    onChange={(event) =>
                      handleAssignmentChange(workplace.id, event.target.value || null)
                    }
                  >
                    <option value="">—</option>
                    {regionalOffices.map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.name}
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
