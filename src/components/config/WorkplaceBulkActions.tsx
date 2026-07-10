import type { OrganizationSnapshot } from '../../domain/organization/types'

interface WorkplaceBulkActionsProps {
  selectedIds: string[]
  snapshot: OrganizationSnapshot
  mode: 'region' | 'leader'
  onApplyRegion: (regionId: string) => void
  onApplyLeader: (leaderId: string) => void
  onClearSelection: () => void
}

export function WorkplaceBulkActions({
  selectedIds,
  snapshot,
  mode,
  onApplyRegion,
  onApplyLeader,
  onClearSelection,
}: WorkplaceBulkActionsProps) {
  if (selectedIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      <span className="font-medium text-blue-900">Vybráno: {selectedIds.length}</span>

      {mode === 'region' && (
        <select
          className="rounded-md border border-slate-300 px-3 py-2"
          defaultValue=""
          onChange={(event) => {
            const regionId = event.target.value
            if (!regionId) return
            onApplyRegion(regionId)
            event.target.value = ''
          }}
        >
          <option value="">Přiřadit region…</option>
          {snapshot.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      )}

      {mode === 'leader' && (
        <select
          className="rounded-md border border-slate-300 px-3 py-2"
          defaultValue=""
          onChange={(event) => {
            const leaderId = event.target.value
            if (!leaderId) return
            onApplyLeader(leaderId)
            event.target.value = ''
          }}
        >
          <option value="">Přiřadit vedoucího…</option>
          {snapshot.leaders.map((leader) => (
            <option key={leader.id} value={leader.id}>
              {leader.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5"
        onClick={onClearSelection}
      >
        Zrušit výběr
      </button>
    </div>
  )
}
