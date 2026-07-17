import { useRef, useState } from 'react'
import {
  clearWorkspaceModule,
  estimateWorkspaceSizeBytes,
  restoreWorkspaceBackup,
  serializeWorkspaceBackup,
  validateWorkspaceBackup,
  type WorkspaceBackup,
  type WorkspaceModuleKey,
} from '../domain/workspace/workspaceBackup'
import {
  isOrganizationSynced,
  useOrganizationActions,
  useOrganizationHydrationStatus,
  useOrganizationSnapshot,
} from '../store/organizationStore'
import { useNotifications } from '../store/notificationStore'

const moduleLabels: Record<WorkspaceModuleKey, string> = {
  organization: 'Organizace',
  config: 'Barvy a přiřazení',
  datasets: 'Datasety',
  map: 'Mapová nastavení',
  workplaceLabelOverrides: 'Popisky pracovišť',
  regionLabelOverrides: 'Popisky regionů',
  templates: 'Šablony',
  exportPresets: 'Exportní presety',
}

export function WorkspaceSettingsPage() {
  const snapshot = useOrganizationSnapshot()
  const hydrationStatus = useOrganizationHydrationStatus()
  const { clearPersistedOrganization } = useOrganizationActions()
  const { notify } = useNotifications()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackup | null>(null)
  const [pendingValidation, setPendingValidation] = useState<ReturnType<
    typeof validateWorkspaceBackup
  > | null>(null)

  const workspaceSizeKb = Math.round(estimateWorkspaceSizeBytes() / 1024)
  const synced = isOrganizationSynced(snapshot)

  function handleExport() {
    const serialized = serializeWorkspaceBackup()
    const blob = new Blob([serialized], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    anchor.href = url
    anchor.download = `map-graph-backup-${date}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify({
      type: 'success',
      title: 'Záloha exportována',
      message: 'Soubor map-graph-backup-*.json byl stažen.',
    })
  }

  async function handleImportFile(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const validation = validateWorkspaceBackup(parsed)
      if (!validation.ok) {
        notify({
          type: 'error',
          title: 'Neplatná záloha',
          message: validation.errors.join(' '),
        })
        return
      }
      setPendingBackup(parsed as WorkspaceBackup)
      setPendingValidation(validation)
    } catch {
      notify({
        type: 'error',
        title: 'Neplatný soubor',
        message: 'Soubor není platný JSON.',
      })
    }
  }

  function confirmRestore() {
    if (!pendingBackup) return
    const failures = restoreWorkspaceBackup(pendingBackup)
    setPendingBackup(null)
    setPendingValidation(null)
    if (failures.length > 0) {
      notify({
        type: 'warning',
        title: 'Záloha částečně obnovena',
        message: failures.join('; '),
      })
    } else {
      notify({
        type: 'success',
        title: 'Záloha obnovena',
        message: 'Aplikace se znovu načte.',
      })
    }
    window.location.reload()
  }

  function handleClearModule(key: WorkspaceModuleKey) {
    const label = moduleLabels[key]
    if (!confirm(`Opravdu vymazat „${label}" z localStorage?`)) return
    clearWorkspaceModule(key)
    notify({ type: 'info', title: 'Data vymazána', message: `${label} bylo odstraněno.` })
    window.location.reload()
  }

  function handleClearOrganization() {
    if (
      !confirm(
        'Vymazat synchronizovanou organizaci? Barvy vedoucích a organizační vazby budou ztraceny. Datasety zůstanou.',
      )
    ) {
      return
    }
    clearPersistedOrganization()
    notify({
      type: 'info',
      title: 'Organizace vymazána',
      message: 'Bude nutné znovu synchronizovat organizaci.',
    })
    window.location.reload()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Pracovní data a záloha</h2>
        <p className="mt-1 text-sm text-slate-600">
          Trvalá data aplikace jsou uložena v prohlížeči. Exportujte zálohu pro bezpečné uchování.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900">Stav workspace</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Organizace</dt>
            <dd className="font-medium text-slate-900">
              {hydrationStatus === 'ready' && synced
                ? 'Synchronizována'
                : hydrationStatus === 'invalid'
                  ? 'Neplatná'
                  : 'Nesynchronizována'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Poslední synchronizace</dt>
            <dd className="font-medium text-slate-900">
              {snapshot.syncedAt
                ? new Date(snapshot.syncedAt).toLocaleString('cs-CZ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Zdrojový soubor</dt>
            <dd className="font-medium text-slate-900">{snapshot.sourceFileName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Odhad velikosti zálohy</dt>
            <dd className="font-medium text-slate-900">{workspaceSizeKb} KB</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-900">Záloha</h3>
        <p className="text-sm text-slate-600">
          Export obsahuje organizaci, datasety, barvy, popisky, šablony a mapová nastavení.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={handleExport}
          >
            Exportovat zálohu aplikace
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Obnovit ze zálohy
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              handleImportFile(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
          />
        </div>
      </section>

      {pendingBackup && pendingValidation?.summary && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Potvrdit obnovení zálohy</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            <li>Datasety: {pendingValidation.summary.datasetCount}</li>
            <li>
              Organizace:{' '}
              {pendingValidation.summary.organizationSynced ? 'synchronizovaná' : 'chybí / prázdná'}
            </li>
            <li>Mapová nastavení: {pendingValidation.summary.hasMapSettings ? 'ano' : 'ne'}</li>
          </ul>
          <p className="mt-2 text-sm text-amber-900">
            Současný workspace bude nahrazen. Pokračovat?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-amber-700 px-3 py-1.5 text-sm text-white"
              onClick={confirmRestore}
            >
              Ano, obnovit
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-400 px-3 py-1.5 text-sm"
              onClick={() => {
                setPendingBackup(null)
                setPendingValidation(null)
              }}
            >
              Zrušit
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
        <h3 className="font-semibold text-red-900">Vymazat pracovní data</h3>
        <p className="text-sm text-red-800">
          Tyto akce jsou nevratné (pokud nemáte zálohu). Datasety a organizaci lze mazat odděleně.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800"
            onClick={handleClearOrganization}
          >
            Vymazat synchronizovanou organizaci
          </button>
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800"
            onClick={() => handleClearModule('datasets')}
          >
            Vymazat všechny datasety
          </button>
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800"
            onClick={() => handleClearModule('config')}
          >
            Vymazat barvy a přiřazení
          </button>
        </div>
      </section>
    </div>
  )
}
