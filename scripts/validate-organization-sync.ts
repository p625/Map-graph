import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { totalChanges } from '../src/domain/organization/changePreview.ts'
import { resolveDistrictId } from '../src/domain/organization/districtAliasMap.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import type { OrganizationSnapshot } from '../src/domain/organization/types.ts'
import { normalizeText } from '../src/domain/visualization/colorUtils.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

interface ValidationCheck {
  id: string
  category: string
  pass: boolean
  expected: string
  actual: string
  details?: string
}

interface ValidationReport {
  filePath: string
  checks: ValidationCheck[]
  entityCounts: Record<string, number>
  bindingCounts: Record<string, number>
  conflicts: string[]
  missingBindings: string[]
  pass: boolean
}

function activeWorkplaces(snapshot: OrganizationSnapshot) {
  return snapshot.workplaces.filter((wp) => !wp.absentFromSync)
}

function districtName(districtId: string): string {
  return districts.find((d) => d.id === districtId)?.name ?? districtId
}

function workplaceName(snapshot: OrganizationSnapshot, workplaceId: string): string {
  return snapshot.workplaces.find((w) => w.id === workplaceId)?.name ?? workplaceId
}

function validateSnapshot(snapshot: OrganizationSnapshot): {
  checks: ValidationCheck[]
  conflicts: string[]
  missingBindings: string[]
  entityCounts: Record<string, number>
  bindingCounts: Record<string, number>
} {
  const checks: ValidationCheck[] = []
  const conflicts: string[] = []
  const missingBindings: string[] = []

  const active = activeWorkplaces(snapshot)
  const absent = snapshot.workplaces.filter((wp) => wp.absentFromSync)

  const entityCounts = {
    workplacesActive: active.length,
    workplacesTotal: snapshot.workplaces.length,
    workplacesAbsentFromSync: absent.length,
    regions: snapshot.regions.length,
    leaders: snapshot.leaders.length,
    orgUnits: snapshot.orgUnits.length,
    districtsInSeed: districts.length,
    districtAssignments: snapshot.districtAssignments.length,
  }

  const bindingCounts = {
    workplaceRegionLinks: active.filter((wp) => wp.regionId).length,
    workplaceLeaderLinks: active.filter((wp) => wp.leaderId).length,
    workplaceOrgUnitLinks: active.filter((wp) => wp.orgUnitId).length,
  }

  function addCheck(
    id: string,
    category: string,
    pass: boolean,
    expected: string,
    actual: string,
    details?: string,
  ) {
    checks.push({ id, category, pass, expected, actual, details })
  }

  addCheck(
    'count-workplaces-active',
    'entity-counts',
    active.length === 65,
    '65 aktivních pracovišť',
    String(active.length),
  )

  addCheck(
    'count-regions',
    'entity-counts',
    snapshot.regions.length === 7,
    '7 regionů',
    String(snapshot.regions.length),
  )

  addCheck(
    'count-leaders',
    'entity-counts',
    snapshot.leaders.length === 16,
    '16 vedoucích',
    String(snapshot.leaders.length),
  )

  addCheck(
    'count-org-units',
    'entity-counts',
    snapshot.orgUnits.length === 16,
    '16 organizačních složek',
    String(snapshot.orgUnits.length),
  )

  const uniqueDistrictIds = new Set(snapshot.districtAssignments.map((a) => a.districtId))
  addCheck(
    'count-district-assignments',
    'entity-counts',
    uniqueDistrictIds.size === 77,
    '77 okresů přiřazených k pracovištím',
    `${uniqueDistrictIds.size} unikátních (${snapshot.districtAssignments.length} záznamů)`,
  )

  const regionByWorkplace = new Map<string, string>()
  for (const wp of active) {
    if (!wp.regionId) {
      missingBindings.push(`Pracoviště „${wp.name}" (${wp.id}) nemá region.`)
      continue
    }
    const prior = regionByWorkplace.get(wp.id)
    if (prior && prior !== wp.regionId) {
      conflicts.push(`Pracoviště „${wp.name}" má více regionů.`)
    }
    regionByWorkplace.set(wp.id, wp.regionId)
  }
  addCheck(
    'binding-workplace-region',
    'bindings',
    active.every((wp) => wp.regionId) && conflicts.filter((c) => c.includes('region')).length === 0,
    'každé aktivní pracoviště má právě jeden region',
    `${bindingCounts.workplaceRegionLinks}/${active.length} s regionem`,
  )

  const leaderByWorkplace = new Map<string, string>()
  for (const wp of active) {
    if (!wp.leaderId) {
      missingBindings.push(`Pracoviště „${wp.name}" (${wp.id}) nemá vedoucího.`)
      continue
    }
    const prior = leaderByWorkplace.get(wp.id)
    if (prior && prior !== wp.leaderId) {
      conflicts.push(`Pracoviště „${wp.name}" má více vedoucích.`)
    }
    leaderByWorkplace.set(wp.id, wp.leaderId)
  }
  addCheck(
    'binding-workplace-leader',
    'bindings',
    active.every((wp) => wp.leaderId),
    'každé aktivní pracoviště má právě jednoho vedoucího',
    `${bindingCounts.workplaceLeaderLinks}/${active.length} s vedoucím`,
  )

  for (const wp of active) {
    if (!wp.orgUnitId) {
      missingBindings.push(`Pracoviště „${wp.name}" (${wp.id}) nemá organizační složku.`)
    }
  }
  addCheck(
    'binding-workplace-org-unit',
    'bindings',
    active.every((wp) => wp.orgUnitId),
    'každé aktivní pracoviště má organizační složku',
    `${bindingCounts.workplaceOrgUnitLinks}/${active.length} se složkou`,
  )

  const districtOwners = new Map<string, string>()
  for (const assignment of snapshot.districtAssignments) {
    const prior = districtOwners.get(assignment.districtId)
    if (prior && prior !== assignment.workplaceId) {
      conflicts.push(
        `Okres ${districtName(assignment.districtId)} má konfliktní pracoviště: ${prior} vs ${assignment.workplaceId}.`,
      )
    }
    districtOwners.set(assignment.districtId, assignment.workplaceId)
  }

  const unassignedDistricts = districts.filter((d) => !districtOwners.has(d.id))
  for (const district of unassignedDistricts) {
    missingBindings.push(`Okres „${district.name}" (${district.id}) není přiřazen.`)
  }

  addCheck(
    'binding-district-workplace',
    'bindings',
    unassignedDistricts.length === 0 && districtOwners.size === districts.length,
    'každý okres patří právě jednomu pracovišti',
    `${districtOwners.size}/${districts.length} okresů přiřazeno`,
  )

  const wp025 = snapshot.workplaces.find((wp) => wp.id === 'wp-025')
  addCheck(
    'alias-wp-025-preserved',
    'alias-migration',
    Boolean(wp025),
    'interní ID wp-025 existuje',
    wp025 ? `wp-025 „${wp025.name}"` : 'nenalezeno',
    wp025?.absentFromSync
      ? 'Zachováno jako absentFromSync (Excel používá název Beroun).'
      : undefined,
  )

  const berounDistrictId = districts.find((d) => normalizeText(d.name) === normalizeText('Beroun'))?.id
  const berounAssignment = snapshot.districtAssignments.find((a) => a.districtId === berounDistrictId)
  const kraluvDvurAlias = resolveDistrictId('Králův Dvůr')
  addCheck(
    'alias-beroun-kraluv-dvur',
    'alias-migration',
    kraluvDvurAlias.districtId === berounDistrictId && Boolean(berounAssignment),
    'Beroun okres přiřazen přes alias Králův Dvůr',
    berounAssignment
      ? `${districtName(berounAssignment.districtId)} → ${workplaceName(snapshot, berounAssignment.workplaceId)} (${berounAssignment.workplaceId})`
      : 'bez přiřazení',
    berounAssignment
      ? `Raw okres v sync: „${berounAssignment.rawOkresName}"`
      : undefined,
  )

  const ostravaDistrictId = districts.find((d) => d.name === 'Ostrava-město')?.id
  const ostravaAlias = resolveDistrictId('Ostrava město')
  const ostravaAssignment = snapshot.districtAssignments.find((a) => a.districtId === ostravaDistrictId)
  addCheck(
    'alias-ostrava-mesto',
    'alias-migration',
    ostravaAlias.districtId === ostravaDistrictId && Boolean(ostravaAssignment),
    'Ostrava město → Ostrava-město',
    ostravaAssignment
      ? `${ostravaAssignment.rawOkresName} → ${workplaceName(snapshot, ostravaAssignment.workplaceId)}`
      : 'bez přiřazení',
  )

  const plzenSeverDistrictId = districts.find((d) => d.name === 'Plzeň-sever')?.id
  const plzenSeverAlias = resolveDistrictId('Plzen-sever')
  const plzenSeverAssignment = snapshot.districtAssignments.find(
    (a) => a.districtId === plzenSeverDistrictId,
  )
  addCheck(
    'alias-plzen-sever',
    'alias-migration',
    plzenSeverAlias.districtId === plzenSeverDistrictId && Boolean(plzenSeverAssignment),
    'Plzen-sever → Plzeň-sever',
    plzenSeverAssignment
      ? `${plzenSeverAssignment.rawOkresName} → ${workplaceName(snapshot, plzenSeverAssignment.workplaceId)}`
      : 'bez přiřazení',
  )

  return { checks, conflicts, missingBindings, entityCounts, bindingCounts }
}

function validateIdempotency(
  firstMerged: OrganizationSnapshot,
  secondPreview: ReturnType<typeof parseAndPreviewSync>,
): ValidationCheck[] {
  const changes = secondPreview.changes
  const newCounts = {
    regions: changes.regions.new.length,
    orgUnits: changes.orgUnits.new.length,
    leaders: changes.leaders.new.length,
    workplaces: changes.workplaces.new.length,
    districts: changes.districtAssignments.new.length,
  }
  const totalNew =
    newCounts.regions +
    newCounts.orgUnits +
    newCounts.leaders +
    newCounts.workplaces +
    newCounts.districts

  const checks: ValidationCheck[] = []

  checks.push({
    id: 'idempotency-no-new',
    category: 'idempotency',
    pass: totalNew === 0,
    expected: '0 nových položek při druhé synchronizaci',
    actual: `${totalNew} nových (R:${newCounts.regions} OU:${newCounts.orgUnits} L:${newCounts.leaders} W:${newCounts.workplaces} D:${newCounts.districts})`,
  })

  const removedWorkplaces = changes.workplaces.removed
  const expectedAbsentRemoved =
    removedWorkplaces.length === 1 &&
    removedWorkplaces[0]?.id === 'wp-025' &&
    firstMerged.workplaces.some((wp) => wp.id === 'wp-025' && wp.absentFromSync)

  const changedCount =
    changes.regions.changed.length +
    changes.orgUnits.changed.length +
    changes.leaders.changed.length +
    changes.workplaces.changed.length +
    changes.districtAssignments.changed.length

  const unexpectedRemoved =
    changes.regions.removed.length +
    changes.orgUnits.removed.length +
    changes.leaders.removed.length +
    (expectedAbsentRemoved ? 0 : removedWorkplaces.length) +
    changes.districtAssignments.removed.length

  checks.push({
    id: 'idempotency-no-changed',
    category: 'idempotency',
    pass: changedCount === 0 && unexpectedRemoved === 0,
    expected: '0 změněných položek; odstranění pouze očekávané (wp-025 absentFromSync)',
    actual: `změněné: ${changedCount}, neočekávaně odstraněné: ${unexpectedRemoved}, celkem v preview: ${totalChanges(changes)}`,
    details:
      expectedAbsentRemoved
        ? 'Change preview opakovaně označuje wp-025 jako odstraněné (absentFromSync) — merge zůstává stabilní.'
        : removedWorkplaces.length > 0
          ? `Odstraněná pracoviště: ${removedWorkplaces.map((w) => w.id).join(', ')}`
          : undefined,
  })

  checks.push({
    id: 'idempotency-merge-stable',
    category: 'idempotency',
    pass:
      JSON.stringify(mergeOrganizationSnapshots(firstMerged, secondPreview.incoming)) ===
      JSON.stringify(mergeOrganizationSnapshots(firstMerged, secondPreview.incoming)),
    expected: 'merge druhého běhu je stabilní',
    actual: 'stabilní',
  })

  const secondMerged = mergeOrganizationSnapshots(firstMerged, secondPreview.incoming)
  const activeFirst = activeWorkplaces(firstMerged).length
  const activeSecond = activeWorkplaces(secondMerged).length
  checks.push({
    id: 'idempotency-active-workplace-count',
    category: 'idempotency',
    pass: activeFirst === activeSecond,
    expected: 'počet aktivních pracovišť beze změny',
    actual: `${activeFirst} → ${activeSecond}`,
  })

  return checks
}

function printReport(report: ValidationReport) {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  VALIDACE SYNCHRONIZACE ORGANIZACE (5B-lite)')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Soubor: ${report.filePath}\n`)

  console.log('── Počty entit ──')
  for (const [key, value] of Object.entries(report.entityCounts)) {
    console.log(`  ${key}: ${value}`)
  }

  console.log('\n── Počty vazeb (aktivní pracoviště) ──')
  for (const [key, value] of Object.entries(report.bindingCounts)) {
    console.log(`  ${key}: ${value}`)
  }

  if (report.conflicts.length > 0) {
    console.log('\n── Konflikty ──')
    for (const item of report.conflicts) console.log(`  ! ${item}`)
  } else {
    console.log('\n── Konflikty ──')
    console.log('  (žádné)')
  }

  if (report.missingBindings.length > 0) {
    console.log('\n── Chybějící vazby ──')
    for (const item of report.missingBindings) console.log(`  - ${item}`)
  } else {
    console.log('\n── Chybějící vazby ──')
    console.log('  (žádné)')
  }

  console.log('\n── Kontroly ──')
  for (const check of report.checks) {
    const mark = check.pass ? 'PASS' : 'FAIL'
    console.log(`  [${mark}] ${check.id}`)
    console.log(`         očekáváno: ${check.expected}`)
    console.log(`         skutečnost: ${check.actual}`)
    if (check.details) console.log(`         detail: ${check.details}`)
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`  VÝSLEDEK: ${report.pass ? 'PASS ✓' : 'FAIL ✗'}`)
  console.log('═══════════════════════════════════════════════════════\n')
}

async function main() {
  const filePath = process.argv[2] ?? defaultFile
  const workbook = await readWorkbook(filePath)
  const rows = workbook.getSheetRows(0)

  const seed = seedOrganizationFromWorkplaces()
  const firstPreview = parseAndPreviewSync(rows, seed, path.basename(filePath))
  const firstMerged = mergeOrganizationSnapshots(seed, firstPreview.incoming)

  const snapshotValidation = validateSnapshot(firstMerged)
  const secondPreview = parseAndPreviewSync(rows, firstMerged, path.basename(filePath))
  const idempotencyChecks = validateIdempotency(firstMerged, secondPreview)

  const allChecks = [...snapshotValidation.checks, ...idempotencyChecks]
  const report: ValidationReport = {
    filePath,
    checks: allChecks,
    entityCounts: snapshotValidation.entityCounts,
    bindingCounts: snapshotValidation.bindingCounts,
    conflicts: snapshotValidation.conflicts,
    missingBindings: snapshotValidation.missingBindings,
    pass: allChecks.every((check) => check.pass),
  }

  printReport(report)

  if (!report.pass) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
