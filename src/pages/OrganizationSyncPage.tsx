import { useMemo, useState, type ReactNode } from 'react'
import type { AuditIssue, AuditSeverity } from '../domain/organization/auditRules'
import { countChanges, totalChanges } from '../domain/organization/changePreview'
import type { AssignmentConflictResolution } from '../domain/organization/assignmentConflicts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  snapshotToConfigAssignments,
  type OrganizationSyncPreview,
} from '../domain/organization/organizationSync'
import { parseTableFile } from '../domain/import/fileParser'
import { useConfigDispatch } from '../store/configStore'
import {
  useOrganizationDispatch,
  useOrganizationState,
} from '../store/organizationStore'
import { useNotifications } from '../store/notificationStore'

type SyncStep = 'import' | 'preview' | 'merge' | 'confirm' | 'saved'

const steps: { id: SyncStep; label: string }[] = [
  { id: 'import', label: 'Import' },
  { id: 'preview', label: 'Preview' },
  { id: 'merge', label: 'Merge' },
  { id: 'confirm', label: 'Potvrzení' },
  { id: 'saved', label: 'Uložení' },
]

const severityStyles: Record<AuditSeverity, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  suggestion: 'border-slate-200 bg-slate-50 text-slate-700',
}

const severityLabels: Record<AuditSeverity, string> = {
  error: 'Chyba',
  warning: 'Varování',
  suggestion: 'Návrh',
}

function AuditIssueList({ issues }: { issues: AuditIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-slate-500">Žádné auditní záznamy.</p>
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}-${index}`}
          className={`rounded-md border px-3 py-2 text-sm ${severityStyles[issue.severity]}`}
        >
          <span className="font-medium">{severityLabels[issue.severity]}:</span> {issue.message}
        </li>
      ))}
    </ul>
  )
}

function ChangeSection({
  title,
  counts,
  children,
}: {
  title: string
  counts: { new: number; changed: number; removed: number; conflicting: number }
  children: ReactNode
}) {
  const total = counts.new + counts.changed + counts.removed + counts.conflicting
  if (total === 0) return null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {counts.new > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
            +{counts.new} nové
          </span>
        )}
        {counts.changed > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
            {counts.changed} změněné
          </span>
        )}
        {counts.removed > 0 && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
            {counts.removed} odstraněné
          </span>
        )}
        {counts.conflicting > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            {counts.conflicting} konfliktní
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

export function OrganizationSyncPage() {
  const { snapshot } = useOrganizationState()
  const orgDispatch = useOrganizationDispatch()
  const configDispatch = useConfigDispatch()
  const { notify } = useNotifications()

  const [step, setStep] = useState<SyncStep>('import')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<OrganizationSyncPreview | null>(null)
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, AssignmentConflictResolution>
  >({})
  const [error, setError] = useState<string | null>(null)

  const stepIndex = steps.findIndex((item) => item.id === step)

  const summary = useMemo(() => {
    if (!preview) return null
    return {
      regions: countChanges(preview.changes.regions),
      orgUnits: countChanges(preview.changes.orgUnits),
      leaders: countChanges(preview.changes.leaders),
      workplaces: countChanges(preview.changes.workplaces),
      districts: countChanges(preview.changes.districtAssignments),
      total: totalChanges(preview.changes),
    }
  }, [preview])

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    setRows([])
    setPreview(null)
    setError(null)
    setStep('import')
    if (!nextFile) return

    try {
      const table = await parseTableFile(nextFile)
      setRows(table.rows as Record<string, unknown>[])
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Načtení souboru selhalo.')
    }
  }

  function handleBuildPreview() {
    if (!file || rows.length === 0) {
      setError('Vyberte synchronizační soubor organizace.xlsx.')
      return
    }
    try {
      const nextPreview = parseAndPreviewSync(rows, snapshot, file.name)
      setPreview(nextPreview)
      setConflictResolutions(nextPreview.defaultResolutions)
      setError(null)
      setStep('preview')
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : 'Preview selhal.')
    }
  }

  function handleMerge() {
    if (!preview) return
    setStep('merge')
  }

  function handleConfirm() {
    if (!preview?.audit.canProceed) {
      setError('Synchronizaci nelze potvrdit — opravte chyby v auditu.')
      return
    }
    setStep('confirm')
  }

  function handleSave() {
    if (!preview) return

    const merged = mergeOrganizationSnapshots(snapshot, preview.incoming, conflictResolutions)
    orgDispatch({ type: 'set-snapshot', snapshot: merged })

    const assignments = snapshotToConfigAssignments(merged)
    configDispatch({
      type: 'apply-organization-sync',
      districtWorkplaceAssignments: assignments.districtWorkplaceAssignments,
      workplaceRegionalAssignments: assignments.workplaceRegionalAssignments,
    })

    notify({
      type: 'success',
      title: 'Synchronizace organizace',
      message: `Uloženo ${merged.regions.length} regionů, ${merged.workplaces.filter((w) => !w.absentFromSync).length} pracovišť.`,
    })

    setStep('saved')
  }

  function resetWorkflow() {
    setFile(null)
    setRows([])
    setPreview(null)
    setConflictResolutions({})
    setError(null)
    setStep('import')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Synchronizace organizace</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Opakovaná synchronizace ze souboru <code className="text-xs">organizace.xlsx</code>.
          Soubor je synchronizační zdroj — interní entity se kvůli aliasům nepřejmenovávají.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {steps.map((item, index) => (
          <li
            key={item.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index <= stepIndex
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === 'import' && (
        <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="org-sync-file">
              Synchronizační soubor
            </label>
            <input
              id="org-sync-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mt-2 block w-full text-sm"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </div>
          {file && (
            <p className="text-sm text-slate-600">
              Načteno <strong>{rows.length}</strong> řádků ze souboru{' '}
              <strong>{file.name}</strong>.
            </p>
          )}
          <button
            type="button"
            disabled={!file || rows.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleBuildPreview}
          >
            Pokračovat na Preview
          </button>
        </section>
      )}

      {step === 'preview' && preview && (
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Audit Rules</h3>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-md bg-red-100 px-2 py-1 text-red-800">
                {preview.audit.errorCount} chyb
              </span>
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">
                {preview.audit.warningCount} varování
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                {preview.audit.suggestionCount} návrhů
              </span>
            </div>
            <div className="mt-4">
              <AuditIssueList issues={preview.audit.issues} />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setStep('import')}
            >
              Zpět
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              onClick={handleMerge}
            >
              Pokračovat na Merge
            </button>
          </div>
        </section>
      )}

      {(step === 'merge' || step === 'confirm' || step === 'saved') && preview && summary && (
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Change Preview</h3>
            <p className="mt-1 text-sm text-slate-600">
              Celkem {summary.total} změn napříč entitami organizace.
            </p>
          </div>

          <ChangeSection
            title="Regiony"
            counts={{
              new: preview.changes.regions.new.length,
              changed: preview.changes.regions.changed.length,
              removed: preview.changes.regions.removed.length,
              conflicting: preview.changes.regions.conflicting.length,
            }}
          >
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.changes.regions.new.map((item) => (
                <li key={item.id}>+ {item.name}</li>
              ))}
              {preview.changes.regions.changed.map((item) => (
                <li key={item.after.id}>
                  ~ {item.before.name} → {item.after.name}
                </li>
              ))}
            </ul>
          </ChangeSection>

          <ChangeSection
            title="Vedoucí"
            counts={{
              new: preview.changes.leaders.new.length,
              changed: preview.changes.leaders.changed.length,
              removed: preview.changes.leaders.removed.length,
              conflicting: preview.changes.leaders.conflicting.length,
            }}
          >
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.changes.leaders.new.map((item) => (
                <li key={item.id}>
                  + {item.name}{' '}
                  <span
                    className="inline-block h-3 w-3 rounded-full align-middle"
                    style={{ backgroundColor: item.color }}
                  />
                </li>
              ))}
            </ul>
          </ChangeSection>

          <ChangeSection
            title="Pracoviště"
            counts={{
              new: preview.changes.workplaces.new.length,
              changed: preview.changes.workplaces.changed.length,
              removed: preview.changes.workplaces.removed.length,
              conflicting: preview.changes.workplaces.conflicting.length,
            }}
          >
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.changes.workplaces.new.map((item) => (
                <li key={item.id}>+ {item.name}</li>
              ))}
              {preview.changes.workplaces.changed.map((item) => (
                <li key={item.after.id}>
                  ~ {item.before.name} ({item.changedFields.join(', ')})
                </li>
              ))}
              {preview.changes.workplaces.removed.map((item) => (
                <li key={item.id} className="text-slate-500">
                  − {item.name} (chybí ve sync)
                </li>
              ))}
              {preview.changes.workplaces.conflicting.map((item, index) => (
                <li key={`conflict-${index}`} className="text-amber-900">
                  ! {item.reason}
                </li>
              ))}
            </ul>
          </ChangeSection>

          <ChangeSection
            title="Konflikty ručních vazeb"
            counts={{
              new: 0,
              changed: preview.assignmentConflicts.length,
              removed: 0,
              conflicting: preview.assignmentConflicts.length,
            }}
          >
            {preview.assignmentConflicts.length === 0 ? (
              <p className="text-sm text-slate-600">Žádné konflikty ručních změn s Excelem.</p>
            ) : (
              <ul className="space-y-3">
                {preview.assignmentConflicts.map((conflict) => {
                  const key = `${conflict.workplaceId}:${conflict.field}`
                  const resolution = conflictResolutions[key] ?? 'keep-local'
                  const fieldLabel = conflict.field === 'regionId' ? 'Region' : 'Vedoucí'
                  return (
                    <li
                      key={key}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm"
                    >
                      <p className="font-medium text-amber-950">
                        {conflict.workplaceName} — {fieldLabel}
                      </p>
                      <p className="mt-1 text-amber-900">
                        Lokálně: <strong>{conflict.localLabel}</strong> · Excel:{' '}
                        <strong>{conflict.incomingLabel}</strong>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={key}
                            checked={resolution === 'keep-local'}
                            onChange={() =>
                              setConflictResolutions((current) => ({
                                ...current,
                                [key]: 'keep-local',
                              }))
                            }
                          />
                          Zachovat lokální
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={key}
                            checked={resolution === 'use-incoming'}
                            onChange={() =>
                              setConflictResolutions((current) => ({
                                ...current,
                                [key]: 'use-incoming',
                              }))
                            }
                          />
                          Použít Excel
                        </label>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ChangeSection>

          <ChangeSection
            title="Přiřazení okresů"
            counts={{
              new: preview.changes.districtAssignments.new.length,
              changed: preview.changes.districtAssignments.changed.length,
              removed: preview.changes.districtAssignments.removed.length,
              conflicting: preview.changes.districtAssignments.conflicting.length,
            }}
          >
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.changes.districtAssignments.changed.map((item) => (
                <li key={item.after.districtId}>
                  ~ {item.after.districtName}: {item.before.beforeWorkplaceName ?? '—'} →{' '}
                  {item.after.afterWorkplaceName ?? '—'}
                </li>
              ))}
            </ul>
          </ChangeSection>

          {step === 'merge' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setStep('preview')}
              >
                Zpět
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                onClick={handleConfirm}
              >
                Pokračovat na Potvrzení
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 space-y-4">
              <p className="text-sm text-amber-900">
                Potvrzením uložíte sloučenou organizaci a aplikujete přiřazení okresů a regionů
                do konfigurace mapy.
                {!preview.audit.canProceed && (
                  <span className="mt-2 block font-medium text-red-700">
                    Synchronizaci nelze uložit kvůli chybám v auditu.
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                  onClick={() => setStep('merge')}
                >
                  Zpět
                </button>
                <button
                  type="button"
                  disabled={!preview.audit.canProceed}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={handleSave}
                >
                  Uložit synchronizaci
                </button>
              </div>
            </div>
          )}

          {step === 'saved' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 space-y-4">
              <p className="text-sm text-emerald-900">
                Synchronizace byla úspěšně uložena. Regionální mapa bude vizualizací sjednocením
                polygonů pracovišť — bez nových polygonů regionů.
              </p>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm"
                onClick={resetWorkflow}
              >
                Nová synchronizace
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
