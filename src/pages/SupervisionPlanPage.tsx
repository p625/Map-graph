import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SupervisionPlanImportDialog } from '../components/supervision-plan/SupervisionPlanImportDialog'
import { SupervisionPlanSummaryPanel } from '../components/supervision-plan/SupervisionPlanSummary'
import { SupervisionPlanTable } from '../components/supervision-plan/SupervisionPlanTable'
import { SupervisionPlanYearSettings } from '../components/supervision-plan/SupervisionPlanYearSettings'
import {
  buildSupervisionPlanCsvContent,
  exportSupervisionPlanXlsx,
} from '../domain/supervision-plan/supervisionPlanExport'
import {
  buildSupervisionPlanExportFile,
  buildSupervisionPlanExportFilename,
  serializeSupervisionPlanExportFile,
} from '../domain/supervision-plan/io/supervision-plan-export'
import {
  reconcileSupervisionYearFilterAfterImport,
} from '../domain/supervision-plan/io/supervision-plan-import'
import type {
  SupervisionPlanImportMode,
  SupervisionPlanImportPreview,
} from '../domain/supervision-plan/io/supervision-plan-schema'
import {
  buildSupervisionPlanTableRows,
  defaultSupervisionPlanFilters,
  filterSupervisionPlanTableRows,
  sortSupervisionPlanRows,
  type SupervisionPlanSortKey,
} from '../domain/supervision-plan/supervisionPlanTable'
import { isOrganizationSynced, useOrganizationSnapshot } from '../store/organizationStore'
import { useNotifications } from '../store/notificationStore'
import {
  countWorkplacesForYear,
  useSupervisionPlan,
  useSupervisionPlanActions,
  useSupervisionPlanImportActions,
} from '../store/supervisionPlanStore'
import { useMapActions, useMapState } from '../store/mapStore'
import { computeSupervisionPlanSummary } from '../domain/supervision-plan/supervisionPlanSummary'
import { downloadTextFile } from '../utils/downloadTextFile'

export function SupervisionPlanPage() {
  const snapshot = useOrganizationSnapshot()
  const plan = useSupervisionPlan()
  const actions = useSupervisionPlanActions()
  const { importPlan, undoLastImport, canUndoImport } = useSupervisionPlanImportActions()
  const { notify } = useNotifications()
  const { setPlugin, setSupervisionYearFilter } = useMapActions()
  const { pluginId, supervisionYearFilter } = useMapState()
  const navigate = useNavigate()
  const synced = isOrganizationSynced(snapshot)

  const [filters, setFilters] = useState(defaultSupervisionPlanFilters)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SupervisionPlanSortKey>('workplace')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [newYearInput, setNewYearInput] = useState('')
  const [showYearSettings, setShowYearSettings] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const activeWorkplaces = useMemo(
    () => snapshot.workplaces.filter((wp) => !wp.absentFromSync),
    [snapshot.workplaces],
  )

  const summary = useMemo(
    () => computeSupervisionPlanSummary(plan, activeWorkplaces),
    [plan, activeWorkplaces],
  )

  const rows = useMemo(() => {
    const built = buildSupervisionPlanTableRows(snapshot, plan)
    const filtered = filterSupervisionPlanTableRows(built, filters, snapshot)
    return sortSupervisionPlanRows(filtered, sortKey, sortDirection)
  }, [snapshot, plan, filters, sortKey, sortDirection])

  const assignmentCountByYear = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const year of plan.years) {
      counts[year.year] = countWorkplacesForYear(plan, year.year)
    }
    return counts
  }, [plan])

  function flashSaved() {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1500)
  }

  function handleExportJson() {
    const exportFile = buildSupervisionPlanExportFile(plan, snapshot, '0.0.0')
    const filename = buildSupervisionPlanExportFilename(plan)
    downloadTextFile(
      serializeSupervisionPlanExportFile(exportFile),
      filename,
      'application/json;charset=utf-8',
    )
    notify({
      type: 'success',
      title: 'Plán supervizí byl exportován',
      message: 'JSON soubor byl stažen.',
    })
  }

  function handleImportConfirm(preview: SupervisionPlanImportPreview, mode: SupervisionPlanImportMode) {
    const activeIds = activeWorkplaces.map((wp) => wp.id)
    const { report, plan: nextPlan } = importPlan(preview, mode, activeIds)
    setImportDialogOpen(false)

    const { filter, resetReason } = reconcileSupervisionYearFilterAfterImport(
      supervisionYearFilter,
      nextPlan,
    )
    if (pluginId === 'supervision-plan' && filter !== supervisionYearFilter) {
      setSupervisionYearFilter(filter)
    }

    const unknownCount = report.ignoredUnknownWorkplaceIds.length
    notify({
      type: 'success',
      title: 'Plán byl importován',
      message: [
        `Importováno ${report.importedAssignmentCount} přiřazení (${mode === 'replace' ? 'nahrazení' : 'sloučení'}).`,
        unknownCount > 0 ? `Ignorováno ${unknownCount} neznámých pracovišť.` : '',
        resetReason ?? '',
        'Použijte tlačítko Vrátit import pro obnovu předchozího plánu.',
      ]
        .filter(Boolean)
        .join(' '),
    })
    flashSaved()
  }

  function handleUndoImport() {
    if (undoLastImport()) {
      notify({ type: 'info', title: 'Import vrácen', message: 'Obnoven plán před posledním importem.' })
      flashSaved()
    }
  }

  function handleAssignYear(workplaceIds: string[], year: number | null) {
    actions.assignYear(workplaceIds, year)
    flashSaved()
  }

  function handleRemoveYear(year: number) {
    const count = countWorkplacesForYear(plan, year)
    if (count > 0) {
      const ok = window.confirm(
        `Rok ${year} má přiřazeno ${count} pracovišť. Odebráním roku se tato přiřazení zruší. Pokračovat?`,
      )
      if (!ok) return
    }
    actions.removeYear(year)
    flashSaved()
  }

  function handleBulkAssignYear() {
    const input = window.prompt('Zadejte rok pro označená pracoviště (nebo prázdné pro zrušení plánu):')
    if (input === null) return
    if (input.trim() === '') {
      if (!window.confirm('Zrušit plán u označených pracovišť?')) return
      handleAssignYear(selectedIds, null)
      return
    }
    const year = Number(input)
    if (!Number.isFinite(year)) {
      notify({ type: 'error', title: 'Neplatný rok', message: 'Zadejte platné číslo roku.' })
      return
    }
    handleAssignYear(selectedIds, Math.round(year))
  }

  function handleResetPlan() {
    if (!window.confirm('Opravdu resetovat celý plán supervizí?')) return
    actions.resetPlan()
    flashSaved()
  }

  function handleAddYear() {
    const year = Number(newYearInput)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      notify({ type: 'error', title: 'Neplatný rok', message: 'Zadejte rok mezi 2000 a 2100.' })
      return
    }
    if (plan.years.some((y) => y.year === year)) {
      notify({ type: 'warning', title: 'Rok existuje', message: `Rok ${year} je již v plánu.` })
      return
    }
    actions.addYear(Math.round(year))
    setNewYearInput('')
    flashSaved()
  }

  function handleSort(key: SupervisionPlanSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  function handleMoveYear(year: number, direction: 'up' | 'down') {
    const index = plan.years.findIndex((y) => y.year === year)
    if (index < 0) return
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= plan.years.length) return
    const next = [...plan.years]
    const temp = next[index]!
    next[index] = next[target]!
    next[target] = temp
    actions.reorderYears(next)
    flashSaved()
  }

  if (!synced) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Plán supervizí vyžaduje synchronizovanou organizaci.</p>
        <Link to="/organization/sync" className="mt-2 inline-block text-blue-700 underline">
          Přejít na synchronizaci organizace
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Plán supervizí</h2>
          <p className="mt-1 text-sm text-slate-600">
            Přiřaďte každému pracovišti plánovaný rok supervize. Změny se ukládají automaticky.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {savedFlash && <span className="rounded bg-green-50 px-2 py-1 text-green-700">Uloženo</span>}
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
            onClick={() => {
              setPlugin('supervision-plan')
              navigate('/map')
            }}
          >
            Zobrazit v mapě
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Název plánu</span>
          <input
            type="text"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={plan.name}
            onChange={(event) => {
              actions.setPlanName(event.target.value)
              flashSaved()
            }}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Přidat rok</span>
            <input
              type="number"
              className="mt-1 block w-28 rounded-md border border-slate-300 px-3 py-2"
              value={newYearInput}
              onChange={(event) => setNewYearInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={handleAddYear}
          >
            Přidat rok
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setShowYearSettings((v) => !v)}
          >
            {showYearSettings ? 'Skrýt barvy' : 'Správa barev'}
          </button>
        </div>
      </div>

      {showYearSettings && (
        <SupervisionPlanYearSettings
          years={plan.years}
          assignmentCountByYear={assignmentCountByYear}
          onColorChange={(year, color) => {
            actions.updateYear(year, { color })
            flashSaved()
          }}
          onToggleActive={(year, isActive) => {
            actions.updateYear(year, { isActive })
            flashSaved()
          }}
          onRemoveYear={handleRemoveYear}
          onMoveYear={handleMoveYear}
        />
      )}

      <SupervisionPlanSummaryPanel summary={summary} />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-6">
        <label className="text-sm lg:col-span-2">
          <span className="font-medium text-slate-700">Hledat pracoviště</span>
          <input
            type="search"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={filters.search}
            onChange={(event) => setFilters((f) => ({ ...f, search: event.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Region</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={filters.regionId}
            onChange={(event) => setFilters((f) => ({ ...f, regionId: event.target.value }))}
          >
            <option value="">Vše</option>
            {snapshot.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Vedoucí</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={filters.leaderId}
            onChange={(event) => setFilters((f) => ({ ...f, leaderId: event.target.value }))}
          >
            <option value="">Všichni</option>
            {snapshot.leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Org. jednotka</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={filters.orgUnitId}
            onChange={(event) => setFilters((f) => ({ ...f, orgUnitId: event.target.value }))}
          >
            <option value="">Vše</option>
            {snapshot.orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.designation} · {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Plánovaný rok</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={filters.plannedYear === '' ? '' : String(filters.plannedYear)}
            onChange={(event) => {
              const value = event.target.value
              setFilters((f) => ({
                ...f,
                plannedYear: value === '' ? '' : value === 'unplanned' ? 'unplanned' : Number(value),
              }))
            }}
          >
            <option value="">Vše</option>
            <option value="unplanned">Bez plánu</option>
            {plan.years
              .filter((y) => y.isActive)
              .map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          disabled={selectedIds.length === 0}
          onClick={handleBulkAssignYear}
        >
          Přiřadit rok ({selectedIds.length})
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          disabled={selectedIds.length === 0}
          onClick={() => {
            if (!window.confirm('Zrušit plán u označených pracovišť?')) return
            handleAssignYear(selectedIds, null)
          }}
        >
          Zrušit plán
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() =>
            exportSupervisionPlanXlsx(snapshot, plan, `plan-supervizi-${new Date().toISOString().slice(0, 10)}.xlsx`)
          }
        >
          Export XLSX
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => {
            const csv = buildSupervisionPlanCsvContent(snapshot, plan)
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `plan-supervizi-${new Date().toISOString().slice(0, 10)}.csv`
            anchor.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export CSV
        </button>
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:inline-block" aria-hidden />
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={handleExportJson}
        >
          Exportovat JSON
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => setImportDialogOpen(true)}
        >
          Importovat JSON
        </button>
        {canUndoImport && (
          <button
            type="button"
            className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
            onClick={handleUndoImport}
          >
            Vrátit import
          </button>
        )}
        <button
          type="button"
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          onClick={handleResetPlan}
        >
          Reset plánu
        </button>
      </div>

      <SupervisionPlanTable
        rows={rows}
        years={plan.years}
        selectedIds={selectedIds}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onToggleSelect={(workplaceId) =>
          setSelectedIds((current) =>
            current.includes(workplaceId)
              ? current.filter((id) => id !== workplaceId)
              : [...current, workplaceId],
          )
        }
        onToggleSelectAll={(checked) => setSelectedIds(checked ? rows.map((row) => row.workplaceId) : [])}
        onAssignYear={(workplaceId, year) => handleAssignYear([workplaceId], year)}
        onNoteChange={(workplaceId, note) => {
          actions.setNote(workplaceId, note)
          flashSaved()
        }}
        onSort={handleSort}
      />

      <SupervisionPlanImportDialog
        open={importDialogOpen}
        currentPlan={plan}
        activeWorkplaceIds={activeWorkplaces.map((wp) => wp.id)}
        onClose={() => setImportDialogOpen(false)}
        onConfirm={handleImportConfirm}
      />
    </div>
  )
}
