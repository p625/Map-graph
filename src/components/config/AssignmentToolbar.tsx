import { useOrganizationActions, useOrganizationHistory } from '../../store/organizationStore'
import { useNotifications } from '../../store/notificationStore'

export function AssignmentToolbar() {
  const { undo, redo } = useOrganizationActions()
  const { canUndo, canRedo } = useOrganizationHistory()
  const { notify } = useNotifications()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canUndo}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => {
          undo()
          notify({ type: 'info', title: 'Zpět', message: 'Obnoven předchozí stav organizačních vazeb.' })
        }}
      >
        Zpět
      </button>
      <button
        type="button"
        disabled={!canRedo}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => {
          redo()
          notify({ type: 'info', title: 'Vpřed', message: 'Obnoven následující stav organizačních vazeb.' })
        }}
      >
        Vpřed
      </button>
    </div>
  )
}
