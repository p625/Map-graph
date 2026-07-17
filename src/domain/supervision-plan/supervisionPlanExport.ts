import * as XLSX from 'xlsx'
import type { OrganizationSnapshot } from '../organization/types'
import type { SupervisionPlan } from './types'
import { getPlannedYear } from './supervisionPlanSummary'

export interface SupervisionPlanExportRow {
  workplace: string
  leader: string
  orgUnit: string
  region: string
  plannedYear: string
  note: string
}

function buildExportRows(
  snapshot: OrganizationSnapshot,
  plan: SupervisionPlan,
): SupervisionPlanExportRow[] {
  const leaderById = new Map(snapshot.leaders.map((l) => [l.id, l]))
  const regionById = new Map(snapshot.regions.map((r) => [r.id, r]))
  const orgUnitById = new Map(snapshot.orgUnits.map((u) => [u.id, u]))

  return snapshot.workplaces
    .filter((wp) => !wp.absentFromSync)
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    .map((workplace) => {
      const leader = workplace.leaderId ? leaderById.get(workplace.leaderId) : undefined
      const region = workplace.regionId ? regionById.get(workplace.regionId) : undefined
      const orgUnit = workplace.orgUnitId ? orgUnitById.get(workplace.orgUnitId) : undefined
      const year = getPlannedYear(plan, workplace.id)
      const note = plan.assignments[workplace.id]?.note ?? ''
      return {
        workplace: workplace.name,
        leader: leader?.name ?? '',
        orgUnit: orgUnit ? `${orgUnit.designation} ${orgUnit.name}`.trim() : '',
        region: region?.name ?? '',
        plannedYear: year === null ? '' : String(year),
        note,
      }
    })
}

function rowsToSheet(rows: SupervisionPlanExportRow[]) {
  return rows.map((row) => ({
    Pracoviště: row.workplace,
    Vedoucí: row.leader,
    'Organizační jednotka': row.orgUnit,
    Region: row.region,
    'Plánovaný rok': row.plannedYear,
    Poznámka: row.note,
  }))
}

export function exportSupervisionPlanXlsx(
  snapshot: OrganizationSnapshot,
  plan: SupervisionPlan,
  filename: string,
): void {
  const rows = buildExportRows(snapshot, plan)
  const sheet = XLSX.utils.json_to_sheet(rowsToSheet(rows))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Plán supervizí')
  XLSX.writeFile(workbook, filename)
}

export function buildSupervisionPlanCsvContent(
  snapshot: OrganizationSnapshot,
  plan: SupervisionPlan,
): string {
  const rows = buildExportRows(snapshot, plan)
  const sheet = XLSX.utils.json_to_sheet(rowsToSheet(rows))
  return `\uFEFF${XLSX.utils.sheet_to_csv(sheet)}`
}

export function buildSupervisionPlanExportRows(
  snapshot: OrganizationSnapshot,
  plan: SupervisionPlan,
): SupervisionPlanExportRow[] {
  return buildExportRows(snapshot, plan)
}
