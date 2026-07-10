import { workplaces as seedWorkplaces } from '../../data/seed/workplaces'
import { districts } from '../../data/seed/districts'
import { classicTheme } from '../visualization/themes/classic'
import { normalizeText } from '../visualization/colorUtils'
import type { AuditIssue } from './auditRules'
import { buildAuditReport, type AuditReport } from './auditRules'
import {
  emptyChangeSet,
  type ChangeSet,
  type DistrictAssignmentChange,
  type OrganizationChangePreview,
} from './changePreview'
import {
  applyAssignmentConflictResolutions,
  defaultConflictResolutions,
  detectWorkplaceAssignmentConflicts,
  type AssignmentConflictResolution,
  type WorkplaceAssignmentConflict,
} from './assignmentConflicts'
import { resolveDistrictId } from './districtAliasMap'
import type {
  DistrictAssignmentAudit,
  Leader,
  OrgUnit,
  OrganizationSnapshot,
  OrganizationWorkplace,
  ParsedOrgRow,
  Region,
} from './types'

const LEADER_COLORS = classicTheme.workplacePalette

const ORG_COLUMNS = {
  okresy: 'Okresy',
  lpis: 'Názvy OPŽL z LPIS',
  opzl: 'OPŽL',
  vedouci: 'Vedoucí',
  orgUnit: 'Organizační složka',
  ro: 'RO',
} as const

function slug(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function trim(value: unknown): string {
  return String(value ?? '').trim()
}

function stableWorkplaceId(name: string, existingIds: Map<string, string>): string {
  const norm = normalizeText(name)
  const existing = existingIds.get(norm)
  if (existing) return existing
  const seedMatch = seedWorkplaces.find((w) => normalizeText(w.name) === norm)
  if (seedMatch) return seedMatch.id
  return `wp-${slug(name)}`
}

function leaderColor(index: number, preserved?: string): string {
  if (preserved) return preserved
  return LEADER_COLORS[index % LEADER_COLORS.length] ?? '#64748b'
}

export function parseOrganizaceRows(rows: Record<string, unknown>[]): ParsedOrgRow[] {
  return rows
    .filter((row) => Object.values(row).some((v) => trim(v) !== ''))
    .map((row) => {
      const rawOkresName = trim(row[ORG_COLUMNS.okresy])
      const { districtId, aliasUsed } = resolveDistrictId(rawOkresName)
      return {
        rawOkresName,
        lpisName: trim(row[ORG_COLUMNS.lpis]),
        workplaceName: trim(row[ORG_COLUMNS.opzl]),
        leaderName: trim(row[ORG_COLUMNS.vedouci]),
        orgUnitDesignation: trim(row[ORG_COLUMNS.orgUnit]),
        regionName: trim(row[ORG_COLUMNS.ro]),
        resolvedDistrictId: districtId,
        districtAliasUsed: aliasUsed,
      }
    })
}

export function buildSnapshotFromRows(
  rows: ParsedOrgRow[],
  params: { sourceFileName?: string } = {},
): { snapshot: OrganizationSnapshot; issues: AuditIssue[] } {
  const issues: AuditIssue[] = []
  const existingWpIds = new Map<string, string>(
    seedWorkplaces.map((w) => [normalizeText(w.name), w.id]),
  )

  const regionMap = new Map<string, Region>()
  const orgUnitMap = new Map<string, OrgUnit>()
  const leaderMap = new Map<string, Leader>()
  const workplaceMap = new Map<string, OrganizationWorkplace>()
  const districtAssignments: DistrictAssignmentAudit[] = []
  const districtAssignmentTarget = new Map<string, string>()

  let leaderIndex = 0

  for (const row of rows) {
    if (!row.workplaceName) {
      issues.push({
        severity: 'error',
        code: 'missing_workplace',
        message: `Řádek okresu „${row.rawOkresName}" nemá vyplněné OPŽL.`,
        context: { okres: row.rawOkresName },
      })
      continue
    }

    if (!row.regionName) {
      issues.push({
        severity: 'error',
        code: 'missing_region',
        message: `Řádek „${row.rawOkresName}" nemá vyplněný regionální odbor (RO).`,
        context: { okres: row.rawOkresName },
      })
    }

    if (!row.leaderName) {
      issues.push({
        severity: 'error',
        code: 'missing_leader',
        message: `Řádek „${row.rawOkresName}" nemá vyplněného vedoucího.`,
        context: { okres: row.rawOkresName },
      })
    }

    if (!row.orgUnitDesignation) {
      issues.push({
        severity: 'error',
        code: 'missing_org_unit',
        message: `Řádek „${row.rawOkresName}" nemá organizační složku.`,
        context: { okres: row.rawOkresName },
      })
    } else if (!/^S\d+$/i.test(row.orgUnitDesignation)) {
      issues.push({
        severity: 'warning',
        code: 'invalid_org_unit_format',
        message: `Organizační složka „${row.orgUnitDesignation}" nemá očekávaný formát SXXXXX.`,
        context: { orgUnit: row.orgUnitDesignation },
      })
    }

    if (!row.resolvedDistrictId) {
      issues.push({
        severity: 'error',
        code: 'unmapped_district',
        message: `Okres „${row.rawOkresName}" nelze namapovat na seed okresy.`,
        context: { okres: row.rawOkresName },
      })
      continue
    }

    if (row.districtAliasUsed) {
      issues.push({
        severity: 'suggestion',
        code: 'district_alias_used',
        message: `Okres „${row.rawOkresName}" mapován přes alias na „${row.districtAliasUsed}".`,
        context: { okres: row.rawOkresName, alias: row.districtAliasUsed },
      })
    }

    if (!row.lpisName) {
      issues.push({
        severity: 'suggestion',
        code: 'empty_lpis_name',
        message: `Řádek „${row.rawOkresName}" nemá LPIS název — sdílí nadřazené OPŽL.`,
        context: { okres: row.rawOkresName, workplace: row.workplaceName },
      })
    }

    const regionId = `region-${slug(row.regionName)}`
    if (row.regionName && !regionMap.has(regionId)) {
      regionMap.set(regionId, {
        id: regionId,
        name: row.regionName,
        code: slug(row.regionName),
      })
    }

    const orgUnitId = row.orgUnitDesignation.toUpperCase()
    if (orgUnitId && !orgUnitMap.has(orgUnitId)) {
      orgUnitMap.set(orgUnitId, {
        id: orgUnitId,
        designation: orgUnitId,
        name: row.leaderName || orgUnitId,
      })
    }

    const leaderId = `leader-${slug(row.leaderName)}`
    if (row.leaderName && !leaderMap.has(leaderId)) {
      leaderMap.set(leaderId, {
        id: leaderId,
        name: row.leaderName,
        orgUnitId,
        color: leaderColor(leaderIndex++),
      })
    }

    const workplaceId = stableWorkplaceId(row.workplaceName, existingWpIds)
    existingWpIds.set(normalizeText(row.workplaceName), workplaceId)

    const existingWp = workplaceMap.get(workplaceId)
    if (existingWp) {
      if (existingWp.regionId !== regionId) {
        issues.push({
          severity: 'warning',
          code: 'workplace_multi_region',
          message: `OPŽL „${row.workplaceName}" má více regionů v synchronizačním souboru.`,
          context: { workplace: row.workplaceName },
        })
      }
      if (existingWp.leaderId !== leaderId) {
        issues.push({
          severity: 'warning',
          code: 'workplace_multi_leader',
          message: `OPŽL „${row.workplaceName}" má více vedoucích v souboru.`,
          context: { workplace: row.workplaceName },
        })
      }
    } else {
      workplaceMap.set(workplaceId, {
        id: workplaceId,
        name: row.workplaceName,
        regionId,
        leaderId,
        orgUnitId,
        lpisName: row.lpisName || undefined,
      })
    }

    const priorTarget = districtAssignmentTarget.get(row.resolvedDistrictId)
    if (priorTarget && priorTarget !== workplaceId) {
      issues.push({
        severity: 'error',
        code: 'district_conflict',
        message: `Okres má v souboru konfliktní přiřazení OPŽL.`,
        context: {
          districtId: row.resolvedDistrictId,
          okres: row.rawOkresName,
        },
      })
    } else {
      districtAssignmentTarget.set(row.resolvedDistrictId, workplaceId)
      districtAssignments.push({
        districtId: row.resolvedDistrictId,
        workplaceId,
        rawOkresName: row.rawOkresName,
        lpisName: row.lpisName,
      })
    }
  }

  const snapshot: OrganizationSnapshot = {
    regions: [...regionMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    orgUnits: [...orgUnitMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    leaders: [...leaderMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    workplaces: [...workplaceMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    districtAssignments,
    syncedAt: new Date().toISOString(),
    sourceFileName: params.sourceFileName,
  }

  return { snapshot, issues }
}

function compareById<T extends { id: string }>(
  current: T[],
  incoming: T[],
  fields: (keyof T)[],
): ChangeSet<T> {
  const result = emptyChangeSet<T>()
  const currentMap = new Map(current.map((item) => [item.id, item]))
  const incomingMap = new Map(incoming.map((item) => [item.id, item]))

  for (const item of incoming) {
    const before = currentMap.get(item.id)
    if (!before) {
      result.new.push(item)
      continue
    }
    const changedFields = fields.filter((f) => before[f] !== item[f])
    if (changedFields.length > 0) {
      result.changed.push({ before, after: item, changedFields: changedFields as string[] })
    }
  }

  for (const item of current) {
    if (!incomingMap.has(item.id)) {
      result.removed.push(item)
    }
  }

  return result
}

function compareWorkplaces(
  current: OrganizationWorkplace[],
  incoming: OrganizationWorkplace[],
): ChangeSet<OrganizationWorkplace> {
  const byId = compareById(current, incoming, [
    'name',
    'regionId',
    'leaderId',
    'orgUnitId',
    'lpisName',
  ])

  for (const inc of incoming) {
    if (byId.new.some((n) => n.id === inc.id)) {
      const orphan = current.find(
        (c) =>
          !incoming.some((i) => i.id === c.id) &&
          normalizeText(c.name) !== normalizeText(inc.name),
      )
      if (orphan) {
        byId.conflicting.push({
          local: orphan,
          incoming: inc,
          reason: `Lokální „${orphan.name}" (id ${orphan.id}) vs synchronizační „${inc.name}" (id ${inc.id}).`,
        })
      }
    }
  }

  return byId
}

function compareDistrictAssignments(
  current: DistrictAssignmentAudit[],
  incoming: DistrictAssignmentAudit[],
  currentWorkplaces: OrganizationWorkplace[],
  incomingWorkplaces: OrganizationWorkplace[],
): ChangeSet<DistrictAssignmentChange> {
  const result = emptyChangeSet<DistrictAssignmentChange>()
  const districtName = new Map(districts.map((d) => [d.id, d.name]))
  const wpName = (id: string | null, list: OrganizationWorkplace[]) =>
    list.find((w) => w.id === id)?.name

  const currentMap = new Map(current.map((a) => [a.districtId, a]))
  const incomingMap = new Map(incoming.map((a) => [a.districtId, a]))

  for (const inc of incoming) {
    const before = currentMap.get(inc.districtId)
    if (!before) {
      result.new.push({
        districtId: inc.districtId,
        districtName: districtName.get(inc.districtId) ?? inc.districtId,
        beforeWorkplaceId: null,
        afterWorkplaceId: inc.workplaceId,
        afterWorkplaceName: wpName(inc.workplaceId, incomingWorkplaces),
      })
      continue
    }
    if (before.workplaceId !== inc.workplaceId) {
      result.changed.push({
        before: {
          districtId: inc.districtId,
          districtName: districtName.get(inc.districtId) ?? inc.districtId,
          beforeWorkplaceId: before.workplaceId,
          afterWorkplaceId: before.workplaceId,
          beforeWorkplaceName: wpName(before.workplaceId, currentWorkplaces),
        },
        after: {
          districtId: inc.districtId,
          districtName: districtName.get(inc.districtId) ?? inc.districtId,
          beforeWorkplaceId: before.workplaceId,
          afterWorkplaceId: inc.workplaceId,
          beforeWorkplaceName: wpName(before.workplaceId, currentWorkplaces),
          afterWorkplaceName: wpName(inc.workplaceId, incomingWorkplaces),
        },
        changedFields: ['workplaceId'],
      })
    }
  }

  for (const cur of current) {
    if (!incomingMap.has(cur.districtId)) {
      result.removed.push({
        districtId: cur.districtId,
        districtName: districtName.get(cur.districtId) ?? cur.districtId,
        beforeWorkplaceId: cur.workplaceId,
        afterWorkplaceId: null,
        beforeWorkplaceName: wpName(cur.workplaceId, currentWorkplaces),
      })
    }
  }

  return result
}

export interface OrganizationSyncPreview {
  incoming: OrganizationSnapshot
  audit: AuditReport
  changes: OrganizationChangePreview
  merged: OrganizationSnapshot
  assignmentConflicts: WorkplaceAssignmentConflict[]
  defaultResolutions: Record<string, AssignmentConflictResolution>
}

export function buildOrganizationSyncPreview(
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
  parseIssues: AuditIssue[] = [],
): OrganizationSyncPreview {
  const auditIssues = [...parseIssues]

  const workplaceChanges = compareWorkplaces(current.workplaces, incoming.workplaces)
  for (const c of workplaceChanges.conflicting) {
    auditIssues.push({
      severity: 'warning',
      code: 'workplace_name_conflict',
      message: c.reason,
      context: { local: c.local.name, incoming: c.incoming.name },
    })
  }

  const assignmentConflicts = detectWorkplaceAssignmentConflicts(current, incoming)
  for (const conflict of assignmentConflicts) {
    auditIssues.push({
      severity: 'warning',
      code: 'manual_assignment_conflict',
      message: `Ruční změna ${conflict.field === 'regionId' ? 'regionu' : 'vedoucího'} u „${conflict.workplaceName}": lokálně ${conflict.localLabel}, Excel ${conflict.incomingLabel}.`,
      context: {
        workplaceId: conflict.workplaceId,
        field: conflict.field,
      },
    })
  }

  const changes: OrganizationChangePreview = {
    regions: compareById<Region>(current.regions, incoming.regions, ['name', 'code']),
    orgUnits: compareById<OrgUnit>(current.orgUnits, incoming.orgUnits, ['designation', 'name']),
    leaders: compareById<Leader>(current.leaders, incoming.leaders, ['name', 'orgUnitId', 'color']),
    workplaces: workplaceChanges,
    districtAssignments: compareDistrictAssignments(
      current.districtAssignments,
      incoming.districtAssignments,
      current.workplaces,
      incoming.workplaces,
    ),
  }

  const defaultResolutions = defaultConflictResolutions(assignmentConflicts)

  return {
    incoming,
    audit: buildAuditReport(auditIssues),
    changes,
    merged: mergeOrganizationSnapshots(current, incoming, defaultResolutions),
    assignmentConflicts,
    defaultResolutions,
  }
}

export function mergeOrganizationSnapshots(
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
  conflictResolutions: Record<string, AssignmentConflictResolution> = defaultConflictResolutions(
    detectWorkplaceAssignmentConflicts(current, incoming),
  ),
): OrganizationSnapshot {
  const leaderColorById = new Map(current.leaders.map((l) => [l.id, l.color]))
  const incomingWpIds = new Set(incoming.workplaces.map((w) => w.id))

  const leaders = incoming.leaders.map((leader, index) => ({
    ...leader,
    color: leaderColorById.get(leader.id) ?? leaderColor(index, leader.color),
  }))

  const removedWorkplaces = current.workplaces
    .filter((w) => !incomingWpIds.has(w.id))
    .map((w) => ({ ...w, absentFromSync: true }))

  const mergedWorkplaces = applyAssignmentConflictResolutions(
    current,
    incoming,
    conflictResolutions,
  )

  return {
    regions: incoming.regions,
    orgUnits: incoming.orgUnits,
    leaders,
    workplaces: [...mergedWorkplaces, ...removedWorkplaces],
    districtAssignments: incoming.districtAssignments,
    syncedAt: incoming.syncedAt,
    sourceFileName: incoming.sourceFileName,
  }
}

export function snapshotToConfigAssignments(snapshot: OrganizationSnapshot): {
  districtWorkplaceAssignments: Record<string, string>
  workplaceRegionalAssignments: Record<string, string>
} {
  const districtWorkplaceAssignments: Record<string, string> = {}
  for (const a of snapshot.districtAssignments) {
    districtWorkplaceAssignments[a.districtId] = a.workplaceId
  }

  const workplaceRegionalAssignments: Record<string, string> = {}
  for (const wp of snapshot.workplaces) {
    if (!wp.absentFromSync && wp.regionId) {
      workplaceRegionalAssignments[wp.id] = wp.regionId
    }
  }

  return { districtWorkplaceAssignments, workplaceRegionalAssignments }
}

export function seedOrganizationFromWorkplaces(): OrganizationSnapshot {
  return {
    regions: [],
    orgUnits: [],
    leaders: [],
    workplaces: seedWorkplaces.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      regionId: '',
      leaderId: '',
      orgUnitId: '',
    })),
    districtAssignments: [],
  }
}

export function parseAndPreviewSync(
  rows: Record<string, unknown>[],
  current: OrganizationSnapshot,
  sourceFileName?: string,
): OrganizationSyncPreview {
  const parsed = parseOrganizaceRows(rows)
  const { snapshot: incoming, issues } = buildSnapshotFromRows(parsed, { sourceFileName })
  return buildOrganizationSyncPreview(current, incoming, issues)
}
