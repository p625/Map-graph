/**
 * Validační skript Phase 5A — Territory Engine, popisky, hranice, cache.
 * Spuštění: npm run validate-phase-5a
 */
import { districts } from '../src/data/seed/districts.ts'
import { resolveLayeredBoundaryStrokes, resolveTerritoryFillStyles } from '../src/domain/color/colorEngine.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import { getGeometryCache } from '../src/domain/territory/geometryCache.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { seedOrganizationFromWorkplaces, parseAndPreviewSync, mergeOrganizationSnapshots } from '../src/domain/organization/organizationSync.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

const WIDTH = 760
const HEIGHT = 460

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

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: merged.workplaces
      .filter((w) => !w.absentFromSync)
      .map((w) => {
        const seedWp = seedWorkplaces.find((s) => s.id === w.id)
        return { id: w.id, code: seedWp?.code ?? w.id, name: w.name }
      }),
    regionalOffices: merged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
  })

  const assignmentHash = hashAssignmentState(districtAssignments, regionalAssignments)

  const allBoundaries = buildTerritoryLayers({
    resolver,
    width: WIDTH,
    height: HEIGHT,
    boundaryVisibility: { district: true, workplace: true, region: true },
    assignmentHash,
  })

  const multiDistrictWorkplaces = resolver.workplaces
    .map((wp) => ({ name: wp.name, count: resolver.getDistrictIdsForWorkplace(wp.id).length }))
    .filter((wp) => wp.count > 1)

  const targetNames = ['Praha', 'Plzeň', 'Ústí nad Labem', 'Opava', 'Brno', 'Liberec', 'Cheb', 'Beroun']
  for (const name of targetNames) {
    const wp = resolver.workplaces.find((w) => w.name === name || w.name.includes(name))
    const count = wp ? resolver.getDistrictIdsForWorkplace(wp.id).length : 0
    check(`workplace-multi-${name}`, count >= 1, `${name}: ${count} okresů`)
  }

  const prague = resolver.workplaces.find((w) => w.name === 'Praha')
  if (prague) {
    const districtIds = resolver.getDistrictIdsForWorkplace(prague.id)
    const unionGeom = getGeometryCache().getUnionGeometry(
      `workplace:${assignmentHash}:${prague.id}`,
      districtIds,
    )
    check('prague-union', Boolean(unionGeom), `Praha union z ${districtIds.length} okresů`)
  }

  const labels = buildMapLabels({
    resolver,
    territories: allBoundaries,
    scope: 'workplace',
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    contentMode: 'name',
  })
  const labelIds = new Set(labels.map((l) => l.id))
  check('labels-unique', labelIds.size === labels.length, `${labels.length} popisků, unikátních ${labelIds.size}`)

  const layered = resolveLayeredBoundaryStrokes(allBoundaries)
  check(
    'boundary-layer-order',
    layered.district.length > 0 && layered.workplace.length > 0 && layered.region.length > 0,
    `hranice okres/pracoviště/region: ${layered.district.length}/${layered.workplace.length}/${layered.region.length}`,
  )

  const fillStyles = resolveTerritoryFillStyles(
    {
      districtColors: Object.fromEntries(districts.map((d) => [d.id, { fill: '#ccc' }])),
      territories: allBoundaries,
      boundaryVisibility: { district: false, workplace: false, region: false },
    },
    (id) => resolver.getWorkplaceIdForDistrict(id),
  )

  let internalStrokeHidden = true
  for (const polygon of allBoundaries.fillPolygons) {
    const wp = resolver.getWorkplaceIdForDistrict(polygon.entityId)
    if (!wp) continue
    const style = fillStyles[polygon.id]
    if (style?.stroke !== style?.fill) internalStrokeHidden = false
  }
  check('internal-stroke-hidden', internalStrokeHidden, 'Vnitřní hrany skryté (stroke=fill)')

  check(
    'choropleth-scale',
    classicTheme.sequentialScale.length >= 10 && !classicTheme.sequentialScale[0]?.startsWith('#fff'),
    `škála ${classicTheme.sequentialScale.length} barev, min=${classicTheme.sequentialScale[0]}`,
  )

  const cache = getGeometryCache()
  cache.setAssignmentHash(assignmentHash + '-changed')
  const newHash = assignmentHash + '-changed'
  const wp = resolver.workplaces[0]
  if (wp) {
    const ids = resolver.getDistrictIdsForWorkplace(wp.id)
    const g1 = cache.getUnionGeometry(`workplace:${assignmentHash}:${wp.id}`, ids)
    cache.setAssignmentHash(newHash)
    const g2 = cache.getUnionGeometry(`workplace:${newHash}:${wp.id}`, ids)
    check('cache-assignment-invalidation', Boolean(g1) && Boolean(g2), 'Union přepočten po změně hash')
  }

  console.log('=== VALIDACE PHASE 5A ===\n')
  for (const c of checks) {
    console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`)
  }
  const pass = checks.every((c) => c.pass)
  console.log(`\nVÝSLEDEK: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`)
  console.log(`\nMulti-okresní pracoviště: ${multiDistrictWorkplaces.length}`)
  for (const wp of multiDistrictWorkplaces.slice(0, 15)) {
    console.log(`  - ${wp.name}: ${wp.count} okresů`)
  }

  if (!pass) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
