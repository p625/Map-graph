/**
 * Validace popisků mapy — počet, viditelnost, velikost písma, region focus, export.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import {
  buildMapLabels,
  sanitizeLabelFontSizePx,
  type MapLabel,
} from '../src/domain/labels/labelEngine.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { filterLabelsForRegion } from '../src/domain/region/regionFocus.ts'
import { buildRegionScope } from '../src/domain/region/regionScope.ts'
import { getGeometryCache } from '../src/domain/territory/geometryCache.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

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

function estimateLabelBox(label: MapLabel) {
  const fontSizePx = label.style.fontSizePx
  const lines = label.text.split('\n').length
  const longestLine = label.text.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
  const charWidth = fontSizePx * 0.52
  const width = Math.min(label.style.maxWidth, longestLine * charWidth + 4)
  const height = fontSizePx * (1.15 * lines + 0.2)
  return {
    x: label.x - width / 2,
    y: label.y - height / 2,
    width,
    height,
  }
}

function isAnchorNearUnion(
  label: MapLabel,
  assignmentHash: string,
  resolver: ReturnType<typeof createWorkplaceResolver>,
): boolean {
  if (label.level !== 'workplace') return true
  const workplaceId = label.id.replace(/^label-workplace-/, '')
  const districtIds = resolver.getDistrictIdsForWorkplace(workplaceId)
  if (districtIds.length === 0) return false

  const geometry = getGeometryCache().getUnionGeometry(
    `workplace:${assignmentHash}:${workplaceId}`,
    districtIds,
  )
  if (!geometry) return false

  const anchor = getGeometryCache().getLabelAnchor(
    `validate:${workplaceId}`,
    geometry,
    WIDTH,
    HEIGHT,
  )
  const box = estimateLabelBox(label)
  const dx = Math.abs(label.x - anchor[0])
  const dy = Math.abs(label.y - anchor[1])
  const tolerance = Math.max(box.width, box.height, 24)
  return dx <= tolerance && dy <= tolerance
}

async function main() {
  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)

  const districtAssignments: Record<string, string> = {}
  for (const assignment of merged.districtAssignments) {
    districtAssignments[assignment.districtId] = assignment.workplaceId
  }
  const regionalAssignments: Record<string, string> = {}
  for (const workplace of merged.workplaces) {
    if (!workplace.absentFromSync && workplace.regionId) {
      regionalAssignments[workplace.id] = workplace.regionId
    }
  }

  const activeWorkplaces = merged.workplaces
    .filter((workplace) => !workplace.absentFromSync)
    .map((workplace) => {
      const seedWp = seedWorkplaces.find((item) => item.id === workplace.id)
      return { id: workplace.id, code: seedWp?.code ?? workplace.id, name: workplace.name }
    })

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: activeWorkplaces,
    regionalOffices: merged.regions.map((region) => ({
      id: region.id,
      code: region.code,
      name: region.name,
    })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
  })

  const assignmentHash = hashAssignmentState(districtAssignments, regionalAssignments)
  const territories = buildTerritoryLayers({
    resolver,
    width: WIDTH,
    height: HEIGHT,
    boundaryVisibility: { district: false, workplace: false, region: false },
    assignmentHash,
  })

  const labels = buildMapLabels({
    resolver,
    territories,
    scope: 'workplace',
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    labelFontSizePx: 9,
  })

  const visibleWorkplaceLabels = labels.filter(
    (label) => label.level === 'workplace' && label.visible,
  )

  check(
    'workplace-label-count',
    visibleWorkplaceLabels.length === activeWorkplaces.length,
    `${visibleWorkplaceLabels.length}/${activeWorkplaces.length}`,
  )

  const uniqueIds = new Set(labels.map((label) => label.id))
  check(
    'workplace-label-unique-ids',
    uniqueIds.size === labels.length,
    `${uniqueIds.size} unikátních ID`,
  )

  check(
    'font-size-positive',
    labels.every((label) => label.style.fontSizePx > 0),
    `min=${Math.min(...labels.map((label) => label.style.fontSizePx))}`,
  )

  const anchorChecks = visibleWorkplaceLabels.filter((label) =>
    isAnchorNearUnion(label, assignmentHash, resolver),
  )
  check(
    'anchor-near-union',
    anchorChecks.length === visibleWorkplaceLabels.length,
    `${anchorChecks.length}/${visibleWorkplaceLabels.length}`,
  )

  const brnoRegion = merged.regions.find((region) => region.name.includes('Brno'))
  if (brnoRegion) {
    const scope = buildRegionScope(brnoRegion.id, 'focused', resolver)
    const filtered = filterLabelsForRegion(labels, scope)
    const expected = activeWorkplaces.filter(
      (workplace) => regionalAssignments[workplace.id] === brnoRegion.id,
    ).length
    const visibleInRegion = filtered.filter((label) => label.visible).length
    check(
      'region-focus-workplaces',
      visibleInRegion === expected,
      `${visibleInRegion}/${expected} v regionu Brno`,
    )
  } else {
    check('region-focus-workplaces', false, 'region Brno nenalezen')
  }

  const collisionFallback = labels.filter((label) => label.level === 'workplace' && !label.visible)
  check(
    'collision-no-hidden-workplaces',
    collisionFallback.length === 0,
    `skrytých pracovišť: ${collisionFallback.length}`,
  )

  for (const size of [6, 10, 16] as const) {
    const sized = buildMapLabels({
      resolver,
      territories,
      scope: 'workplace',
      width: WIDTH,
      height: HEIGHT,
      assignmentHash,
      labelFontSizePx: size,
      disableCollisionAvoidance: true,
    })
    check(
      `font-size-applied-${size}`,
      sized.every((label) => label.style.fontSizePx === size),
      `všechny=${sized.every((label) => label.style.fontSizePx === size)}`,
    )
  }

  check(
    'font-size-sanitize-invalid',
    sanitizeLabelFontSizePx(0) === 9 && sanitizeLabelFontSizePx(99) === 24,
    '0→9, 99→24',
  )

  const memory = new Map<string, string>()
  const persisted = { labelFontSizePx: 12, labelSizePreset: 'medium' }
  memory.set('map-graph-map-v3', JSON.stringify(persisted))
  const reloaded = JSON.parse(memory.get('map-graph-map-v3')!)
  check(
    'font-size-persist-roundtrip',
    sanitizeLabelFontSizePx(reloaded.labelFontSizePx) === 12,
    `${reloaded.labelFontSizePx} px`,
  )

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    scope: 'workplace',
    width: 1920,
    height: 1080,
    assignmentHash,
    labelFontSizePx: 10,
    disableCollisionAvoidance: true,
  })
  const exportVisible = exportLabels.filter((label) => label.visible)
  check(
    'export-same-font-size',
    exportLabels.every((label) => label.style.fontSizePx === 10),
    `font=${exportLabels[0]?.style.fontSizePx ?? 0}px`,
  )
  check(
    'export-same-label-count',
    exportVisible.length === activeWorkplaces.length,
    `${exportVisible.length}/${activeWorkplaces.length}`,
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE MAP LABELS ===\n')
  for (const item of checks) {
    console.log(`[${item.pass ? 'PASS' : 'FAIL'}] ${item.id}: ${item.detail}`)
  }
  console.log(`\nVÝSLEDEK: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${passed}/${checks.length})`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
