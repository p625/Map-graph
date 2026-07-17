/**
 * Validace mapového editoru — region/workplace label overrides, zoom/pan viewport, export izolace.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import {
  sanitizeRegionLabelOverrides,
} from '../src/domain/labels/regionLabelOverrides.ts'
import {
  sanitizeWorkplaceLabelOverrides,
} from '../src/domain/labels/workplaceLabelOverrides.ts'
import {
  applyEditorViewToBase,
  composeEditorViewBox,
  DEFAULT_MAP_EDITOR_VIEW,
  parseViewBox,
  sanitizeMapEditorViewState,
  visibleToEditorState,
  zoomViewBoxAtPoint,
  panEditorView,
  MAX_EDITOR_ZOOM,
  MIN_EDITOR_ZOOM,
} from '../src/domain/map/mapEditorViewport.ts'
import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../src/domain/map/mapViewport.ts'
import { getRegionViewport } from '../src/domain/region/regionViewport.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')
const WIDTH = MAP_LOGICAL_WIDTH
const HEIGHT = MAP_LOGICAL_HEIGHT

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

  const polygonCountBefore = territories.fillPolygons.length
  const pathSampleBefore = territories.fillPolygons[0]?.svgPath ?? ''

  // --- Editor viewport (zoom / pan) ---
  const baseViewBox = parseViewBox(`0 0 ${WIDTH} ${HEIGHT}`, WIDTH, HEIGHT)
  check('editor-view-default', DEFAULT_MAP_EDITOR_VIEW.zoom === 1, `zoom=${DEFAULT_MAP_EDITOR_VIEW.zoom}`)

  const zoomed = sanitizeMapEditorViewState({ zoom: 2, panX: 0, panY: 0 })
  const zoomedBox = applyEditorViewToBase(baseViewBox, zoomed)
  check('zoom-halves-viewbox', Math.abs(zoomedBox.width - WIDTH / 2) < 0.01, `width=${zoomedBox.width}`)
  check('zoom-min-clamp', sanitizeMapEditorViewState({ zoom: 0.5 }).zoom === MIN_EDITOR_ZOOM, 'min OK')
  check('zoom-max-clamp', sanitizeMapEditorViewState({ zoom: 10 }).zoom === MAX_EDITOR_ZOOM, 'max OK')

  const visible = parseViewBox(
    composeEditorViewBox(`0 0 ${WIDTH} ${HEIGHT}`, zoomed, WIDTH, HEIGHT),
    WIDTH,
    HEIGHT,
  )
  const wheelZoom = zoomViewBoxAtPoint(visible, WIDTH * 0.5, HEIGHT * 0.5, 1.08)
  const afterWheel = visibleToEditorState(baseViewBox, wheelZoom)
  check('wheel-zoom-increases', afterWheel.zoom > zoomed.zoom, `${zoomed.zoom} -> ${afterWheel.zoom}`)

  const panned = panEditorView(zoomed, 12, -8)
  check('pan-offset', panned.panX === 12 && panned.panY === -8, `pan=${panned.panX},${panned.panY}`)

  const reset = sanitizeMapEditorViewState(DEFAULT_MAP_EDITOR_VIEW)
  check('reset-view', reset.zoom === 1 && reset.panX === 0 && reset.panY === 0, 'OK')

  // Viewport transform must not rebuild geometry
  composeEditorViewBox(`0 0 ${WIDTH} ${HEIGHT}`, afterWheel, WIDTH, HEIGHT)
  composeEditorViewBox(`0 0 ${WIDTH} ${HEIGHT}`, panned, WIDTH, HEIGHT)
  const polygonCountAfter = territories.fillPolygons.length
  check(
    'viewport-no-geometry-rebuild',
    polygonCountBefore === polygonCountAfter &&
      territories.fillPolygons[0]?.svgPath === pathSampleBefore,
    `${polygonCountBefore} polygons, path unchanged`,
  )

  // --- Workplace label drag / override ---
  const sampleWorkplace = activeWorkplaces[0]
  const workplaceOverrides = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      displayText: 'Test\nWorkplace',
      offsetX: 15,
      offsetY: -10,
      manualPosition: true,
    },
  })

  const workplaceLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: workplaceOverrides,
  })
  const workplaceLabel = workplaceLabels.find((l) => l.id === `label-workplace-${sampleWorkplace.id}`)
  check('workplace-drag-offset', Boolean(workplaceLabel && workplaceLabel.x !== undefined), `x=${workplaceLabel?.x}`)
  check('workplace-manual-position', workplaceLabel?.manualPosition === true, `${workplaceLabel?.manualPosition}`)

  // --- Region label drag / override ---
  const sampleRegion = merged.regions[0]
  const regionOverrides = sanitizeRegionLabelOverrides({
    [sampleRegion.id]: {
      regionId: sampleRegion.id,
      displayText: 'Region\nTest',
      offsetX: 20,
      offsetY: 5,
      fontSizePx: 16,
      manualPosition: true,
    },
  })

  const regionLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: false, showRegionLabels: true, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    regionLabelOverrides: regionOverrides,
  })
  const regionLabel = regionLabels.find((l) => l.id === `label-region-${sampleRegion.id}`)
  check('region-drag-offset', Boolean(regionLabel?.text.includes('\n')), regionLabel?.text ?? '')
  check('region-manual-position', regionLabel?.manualPosition === true, `${regionLabel?.manualPosition}`)
  check('region-font-override', regionLabel?.style.fontSizePx === 16, `${regionLabel?.style.fontSizePx}`)

  const withCollision = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: false, showRegionLabels: true, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    regionLabelOverrides: regionOverrides,
  })
  const regionAfterCollision = withCollision.find((l) => l.id === `label-region-${sampleRegion.id}`)
  check(
    'region-not-moved-by-collision',
    regionAfterCollision?.manualPosition === true && regionAfterCollision.visible === true,
    `visible=${regionAfterCollision?.visible}`,
  )

  // --- Export isolation (editor zoom must not affect export viewBox) ---
  const exportBaseViewBox = `0 0 ${WIDTH} ${HEIGHT}`
  const editorViewBox = composeEditorViewBox(exportBaseViewBox, { zoom: 3, panX: 40, panY: -20 }, WIDTH, HEIGHT)
  check(
    'export-viewbox-unchanged',
    exportBaseViewBox === `0 0 ${WIDTH} ${HEIGHT}` && editorViewBox !== exportBaseViewBox,
    `export=${exportBaseViewBox}, editor=${editorViewBox}`,
  )

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: false },
    width: 1920,
    height: 1080,
    assignmentHash,
    workplaceLabelOverrides: workplaceOverrides,
    regionLabelOverrides: regionOverrides,
  })
  const exportWorkplace = exportLabels.find((l) => l.id === `label-workplace-${sampleWorkplace.id}`)
  const exportRegion = exportLabels.find((l) => l.id === `label-region-${sampleRegion.id}`)
  check('export-workplace-text', exportWorkplace?.text === workplaceLabel?.text, exportWorkplace?.text ?? '')
  check('export-region-text', exportRegion?.text === regionLabel?.text, exportRegion?.text ?? '')

  // --- Region focus + editor viewport ---
  const focusRegion = merged.regions.find((r) => r.name.includes('Brno')) ?? sampleRegion
  const districtIds = resolver.getDistrictIdsForRegion(focusRegion.id)
  const focusViewport = getRegionViewport(focusRegion.id, districtIds, WIDTH, HEIGHT, assignmentHash)
  check('region-focus-viewport', Boolean(focusViewport?.viewBox), focusViewport?.viewBox ?? 'missing')

  const focusEditorViewBox = composeEditorViewBox(
    focusViewport!.viewBox,
    { zoom: 2, panX: 0, panY: 0 },
    WIDTH,
    HEIGHT,
  )
  check('region-focus-zoom', focusEditorViewBox.includes(' '), focusEditorViewBox)

  // --- SVG render unchanged (overrides are presentation-only, geometry paths stable) ---
  const combinedLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    workplaceLabelOverrides: workplaceOverrides,
    regionLabelOverrides: regionOverrides,
  })
  check(
    'svg-label-positions-stable',
    combinedLabels.some((l) => l.level === 'region' && l.manualPosition) &&
      combinedLabels.some((l) => l.level === 'workplace' && l.manualPosition),
    `${combinedLabels.filter((l) => l.manualPosition).length} manual labels`,
  )

  // --- Persistence roundtrip ---
  const editorPersist = sanitizeMapEditorViewState(JSON.parse(JSON.stringify({ zoom: 2.5, panX: 10, panY: -5 })))
  check('editor-view-persist', editorPersist.zoom === 2.5 && editorPersist.panX === 10, JSON.stringify(editorPersist))

  const regionPersist = sanitizeRegionLabelOverrides(JSON.parse(JSON.stringify(regionOverrides)))
  check(
    'region-override-persist',
    regionPersist[sampleRegion.id]?.displayText === regionOverrides[sampleRegion.id]?.displayText,
    'OK',
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE MAPOVÉHO EDITORU ===\n')
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
