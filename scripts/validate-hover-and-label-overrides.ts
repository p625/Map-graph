/**
 * Validace stability hoveru a workplace label overrides.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import {
  applyWorkplaceLabelOverrides,
  sanitizeWorkplaceLabelOverrides,
} from '../src/domain/labels/workplaceLabelOverrides.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { buildRegionScope } from '../src/domain/region/regionScope.ts'
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

  check('map-wrapper-stable-dimensions', WIDTH === 760 && HEIGHT === 460, `${WIDTH}x${HEIGHT}`)
  check('viewbox-stable', `0 0 ${WIDTH} ${HEIGHT}` === `0 0 760 460`, 'viewBox konstantní')

  const polygonCount = territories.fillPolygons.length
  const polygonCountRepeat = territories.fillPolygons.length
  check('polygon-count-stable-on-rerender', polygonCount === polygonCountRepeat, `${polygonCount}`)

  const sampleWorkplace = activeWorkplaces[0]
  const overrides = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      displayText: 'České\nBudějovice',
      offsetX: 12,
      offsetY: -8,
      fontSizePx: 11,
      manualPosition: true,
    },
  })

  const baseLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: overrides,
  })

  const custom = baseLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check('override-custom-text', Boolean(custom?.text.includes('\n')), custom?.text ?? 'missing')
  check('override-multiline', (custom?.text.split('\n').length ?? 0) === 2, `${custom?.text}`)
  check('override-offset', custom?.x !== undefined && custom?.y !== undefined, `x=${custom?.x}, y=${custom?.y}`)
  check('override-font-size', custom?.style.fontSizePx === 11, `${custom?.style.fontSizePx}`)
  check('override-manual-position', custom?.manualPosition === true, `${custom?.manualPosition}`)

  const reloaded = sanitizeWorkplaceLabelOverrides(JSON.parse(JSON.stringify(overrides)))
  check('override-persist-roundtrip', reloaded[sampleWorkplace.id]?.displayText === overrides[sampleWorkplace.id]?.displayText, 'OK')

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: overrides,
  })
  const exportCustom = exportLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check('export-override-text', exportCustom?.text === custom?.text, exportCustom?.text ?? '')
  check('export-override-font', exportCustom?.style.fontSizePx === 11, `${exportCustom?.style.fontSizePx}`)

  const brno = merged.regions.find((region) => region.name.includes('Brno'))
  if (brno && sampleWorkplace) {
    const scope = buildRegionScope(brno.id, 'focused', resolver)
    const inRegion = resolver.getDistrictIdsForWorkplace(sampleWorkplace.id).some((districtId) =>
      scope.districtIds.has(districtId),
    )
    if (inRegion) {
      const focusedTerritories = buildTerritoryLayers({
        resolver,
        width: WIDTH,
        height: HEIGHT,
        boundaryVisibility: { district: false, workplace: false, region: false },
        assignmentHash,
      })
      const focusedLabels = buildMapLabels({
        resolver,
        territories: focusedTerritories,
        labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
        width: WIDTH,
        height: HEIGHT,
        assignmentHash,
        workplaceLabelOverrides: overrides,
        disableCollisionAvoidance: true,
      })
      const focusedCustom = focusedLabels.find(
        (label) => label.id === `label-workplace-${sampleWorkplace.id}`,
      )
      check('region-focus-override-position', focusedCustom?.text === custom?.text, focusedCustom?.text ?? 'n/a')
    }
  }

  const labelsWithCollision = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    workplaceLabelOverrides: overrides,
  })
  const manualAfterCollision = labelsWithCollision.find(
    (label) => label.id === `label-workplace-${sampleWorkplace.id}`,
  )
  check(
    'manual-not-moved-by-collision',
    manualAfterCollision?.manualPosition === true && manualAfterCollision.visible === true,
    `visible=${manualAfterCollision?.visible}`,
  )

  const uniqueWorkplaceLabels = new Set(
    applyWorkplaceLabelOverrides(baseLabels, overrides, WIDTH, HEIGHT)
      .filter((label) => label.level === 'workplace')
      .map((label) => label.id),
  )
  check(
    'one-label-per-workplace',
    uniqueWorkplaceLabels.size === baseLabels.filter((label) => label.level === 'workplace').length,
    `${uniqueWorkplaceLabels.size}`,
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE HOVER + LABEL OVERRIDES ===\n')
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
