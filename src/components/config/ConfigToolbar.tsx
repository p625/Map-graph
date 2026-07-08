import { useConfigDispatch, useConfigHistory } from '../../store/configStore'

export function ConfigToolbar() {
  const dispatch = useConfigDispatch()
  const { canUndo, canRedo } = useConfigHistory()

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canUndo}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => dispatch({ type: 'undo' })}
      >
        Zpět
      </button>
      <button
        type="button"
        disabled={!canRedo}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => dispatch({ type: 'redo' })}
      >
        Vpřed
      </button>
    </div>
  )
}
