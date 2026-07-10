/**
 * Validace Phase 5C.1 — organizační režimy a editovatelné barvy.
 * Spuštění: npm run validate-phase-5c
 */
import { districts } from '../src/data/seed/districts.ts'
import { resolveDistrictDisplayColor } from '../src/domain/color/districtDisplayColors.ts'
import { isValidMapColor, sanitizeMapColor } from '../src/domain/color/mapColorValidation.ts'
import { resolveLeaderColor } from '../src/domain/organization/leaderColors.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { byDistrictPlugin } from '../src/domain/visualization/plugins/byDistrictPlugin.ts'
import { byLeaderPlugin } from '../src/domain/visualization/plugins/byLeaderPlugin.ts'
import { byWorkplacePlugin } from '../src/domain/visualization/plugins/byWorkplacePlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []

function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

async function main() {
  check('color-reject-white', !isValidMapColor('#ffffff'), 'bílá barva zamítnuta')
  check('color-accept-hex', isValidMapColor('#1d4ed8'), 'platný hex přijat')
  check('color-sanitize', sanitizeMapColor('#fff') === null, 'sanitize vrací null pro bílou')

  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)

  const districtAssignments: Record<string, string> = {}
  for (const a of merged.districtAssignments) {
    districtAssignments[a.districtId] = a.workplaceId
  }
  const regionalAssignments: Record<string, string> = {}
  for (const wp of merged.workplaces) {
    if (!wp.absentFromSync && wp.regionId) regionalAssignments[wp.id] = wp.regionId
  }

  const syncedWorkplaces = merged.workplaces
    .filter((w) => !w.absentFromSync)
    .map((w) => ({ id: w.id, code: w.code ?? w.id, name: w.name }))

  const baseContext: VisualizationContext = {
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: merged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    districtDisplayColors: { [districts[0]!.id]: '#2563eb' },
    organization: {
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces.filter((w) => !w.absentFromSync),
    },
    theme: classicTheme,
  }

  check('plugin-leader-org-flag', byLeaderPlugin.requiresOrganization === true, 'by-leader vyžaduje org')
  check('plugin-district-interaction', byDistrictPlugin.districtInteraction === true, 'by-district okresní interakce')

  const leaderColors = byLeaderPlugin.resolveColors(baseContext)
  const uniqueLeaderFills = new Set(Object.values(leaderColors).map((s) => s.fill))
  check('leader-colors', uniqueLeaderFills.size >= 10, `vedoucí odstínů: ${uniqueLeaderFills.size}`)

  const leaderLegend = byLeaderPlugin.buildLegend(baseContext)
  check('leader-legend-count', leaderLegend.items.length === 16, `legendy vedoucích: ${leaderLegend.items.length}`)
  check(
    'leader-legend-subtitle',
    leaderLegend.items.every((item) => Boolean(item.subtitle?.startsWith('S'))),
    'legenda obsahuje org. složku',
  )

  const customDistrictId = districts[0]!.id
  const districtColors = byDistrictPlugin.resolveColors(baseContext)
  check(
    'district-custom-color',
    districtColors[customDistrictId]?.fill === '#2563eb',
    'vlastní barva okresu v by-district',
  )

  const workplaceColors = byWorkplacePlugin.resolveColors(baseContext)
  check(
    'district-colors-isolated',
    workplaceColors[customDistrictId]?.fill !== '#2563eb',
    'barva okresu neovlivní by-workplace',
  )

  const fallback = resolveDistrictDisplayColor(districts[1]!.id, districts[1]!.name, {})
  check('district-fallback', isValidMapColor(fallback), `fallback okresu: ${fallback}`)

  const leader = merged.leaders[0]!
  const resolved = resolveLeaderColor(leader, 0)
  check('leader-color-resolve', isValidMapColor(resolved), `barva vedoucího: ${resolved}`)

  const manualLeader = { ...leader, color: '#c2410c' }
  const manualResolved = resolveLeaderColor(manualLeader, 0)
  check('leader-manual-color', manualResolved === '#c2410c', 'ruční barva vedoucího')

  console.log('=== VALIDACE PHASE 5C.1 ===\n')
  for (const c of checks) {
    console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`)
  }
  const pass = checks.every((c) => c.pass)
  console.log(`\nVÝSLEDEK: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`)
  if (!pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
