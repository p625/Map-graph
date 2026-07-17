/**
 * Validace persistence ručních pozic popisků a společného pohybu názvu s hodnotou.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import { buildRenderedMapLabel } from '../src/domain/labels/labelRenderModel.ts'
import {
  loadPersistedRegionLabelOverrides,
  REGION_LABEL_OVERRIDES_KEY,
  sanitizeRegionLabelOverrides,
  serializeRegionLabelOverrides,
} from '../src/domain/labels/regionLabelOverrides.ts'
import {
  loadPersistedWorkplaceLabelOverrides,
  mergeWorkplaceLabelOverrideMaps,
  WORKPLACE_LABEL_OVERRIDES_KEY,
  sanitizeWorkplaceLabelOverrides,
  serializeWorkplaceLabelOverrides,
} from '../src/domain/labels/workplaceLabelOverrides.ts'
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
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
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

function createMemoryStorage() {
  const memory = new Map<string, string>()
  return {
    saveJson(key: string, value: unknown) {
      memory.set(key, JSON.stringify(value))
      return { ok: true as const, bytes: memory.get(key)?.length ?? 0 }
    },
    loadJson<T>(key: string, fallback: T): T {
      const raw = memory.get(key)
      if (!raw) return fallback
      return JSON.parse(raw) as T
    },
    reload() {
      return memory
    },
  }
}

function buildDatasetContext(
  resolver: ReturnType<typeof createWorkplaceResolver>,
  districtAssignments: Record<string, string>,
  regionalAssignments: Record<string, string>,
  workplaceId: string,
  numericValue: number,
): VisualizationContext {
  const column = {
    id: 'col-count',
    key: 'count',
    name: 'Počet',
    type: 'number' as const,
    sourceField: 'count',
    nullable: false,
  }
  return {
    districts,
    workplaces: resolver.workplaces,
    regionalOffices: resolver.regionalOffices,
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    dataset: {
      id: 'test-dataset',
      name: 'Test',
      source: 'csv',
      importedAt: new Date().toISOString(),
      status: 'ready',
      columns: [column],
      recordCount: 1,
      matchedCount: 1,
      unmatchedCount: 0,
    },
    column,
    records: [
      {
        id: 'rec-1',
        datasetId: 'test-dataset',
        workplaceId,
        matchStatus: 'matched' as const,
        values: { count: numericValue },
      },
    ],
    theme: classicTheme,
  }
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

  const sampleWorkplace = activeWorkplaces[0]!
  const sampleRegion = merged.regions[0]!
  const context = buildDatasetContext(
    resolver,
    districtAssignments,
    regionalAssignments,
    sampleWorkplace.id,
    128,
  )

  const baseLabels = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const baseLabel = baseLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check(
    'name-value-before-override',
    Boolean(baseLabel?.valueText && baseLabel.text.includes(baseLabel.valueText)),
    baseLabel?.text ?? 'missing',
  )

  const baseRendered = baseLabel ? buildRenderedMapLabel(baseLabel) : null
  check(
    'name-value-render-model',
    Boolean(baseRendered?.valueText && baseRendered.contentMode === 'name-value'),
    `${baseRendered?.contentMode}, value=${baseRendered?.valueText}`,
  )

  const baseX = baseLabel?.x ?? 0
  const baseY = baseLabel?.y ?? 0
  const dragOffsetX = 18
  const dragOffsetY = -12

  const draftOverrides = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      offsetX: dragOffsetX,
      offsetY: dragOffsetY,
      manualPosition: true,
    },
  })

  const duringDragLabels = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: draftOverrides,
  })
  const duringDrag = duringDragLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check(
    'name-value-after-drag-offset',
    Boolean(duringDrag?.valueText && duringDrag.text.includes(duringDrag.valueText)),
    duringDrag?.text ?? 'missing',
  )
  check(
    'workplace-offset-applied',
    duringDrag !== undefined &&
      Math.abs((duringDrag.x ?? 0) - (baseX + dragOffsetX)) < 0.01 &&
      Math.abs((duringDrag.y ?? 0) - (baseY + dragOffsetY)) < 0.01,
    `x=${duringDrag?.x}, y=${duringDrag?.y}`,
  )

  const dragRendered = duringDrag ? buildRenderedMapLabel(duringDrag) : null
  check(
    'name-value-shared-transform',
    dragRendered?.finalX === duringDrag?.x && dragRendered?.finalY === duringDrag?.y,
    `final=(${dragRendered?.finalX},${dragRendered?.finalY})`,
  )

  const storage = createMemoryStorage()
  storage.saveJson(WORKPLACE_LABEL_OVERRIDES_KEY, serializeWorkplaceLabelOverrides(draftOverrides))
  const reloadedWorkplace = loadPersistedWorkplaceLabelOverrides(storage.loadJson)
  check(
    'workplace-persist-after-pointerup',
    reloadedWorkplace[sampleWorkplace.id]?.offsetX === dragOffsetX &&
      reloadedWorkplace[sampleWorkplace.id]?.offsetY === dragOffsetY,
    JSON.stringify(reloadedWorkplace[sampleWorkplace.id]),
  )

  const afterReloadLabels = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: reloadedWorkplace,
  })
  const afterReload = afterReloadLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check(
    'workplace-position-after-reload',
    afterReload !== undefined &&
      Math.abs((afterReload.x ?? 0) - (baseX + dragOffsetX)) < 0.01 &&
      Math.abs((afterReload.y ?? 0) - (baseY + dragOffsetY)) < 0.01,
    `x=${afterReload?.x}, y=${afterReload?.y}`,
  )
  check(
    'name-value-after-reload',
    Boolean(afterReload?.valueText && afterReload.text.includes(afterReload.valueText)),
    afterReload?.text ?? 'missing',
  )

  const mergedContext = buildDatasetContext(
    resolver,
    districtAssignments,
    regionalAssignments,
    sampleWorkplace.id,
    256,
  )
  const datasetChangedLabels = buildMapLabels({
    resolver,
    territories,
    context: mergedContext,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: reloadedWorkplace,
  })
  const datasetChanged = datasetChangedLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check(
    'dataset-value-refresh-position-stable',
    datasetChanged !== undefined &&
      Math.abs((datasetChanged.x ?? 0) - (afterReload?.x ?? 0)) < 0.01 &&
      datasetChanged.valueText !== afterReload?.valueText &&
      Boolean(datasetChanged.valueText?.includes('256')),
    `value=${datasetChanged?.valueText}, x=${datasetChanged?.x}`,
  )

  const regionOffsetX = 24
  const regionOffsetY = 8
  const regionOverrides = sanitizeRegionLabelOverrides({
    [sampleRegion.id]: {
      regionId: sampleRegion.id,
      displayText: 'Region\nTest',
      offsetX: regionOffsetX,
      offsetY: regionOffsetY,
      manualPosition: true,
    },
  })
  storage.saveJson(REGION_LABEL_OVERRIDES_KEY, serializeRegionLabelOverrides(regionOverrides))
  const reloadedRegion = loadPersistedRegionLabelOverrides(storage.loadJson)

  const regionBaseLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: false, showRegionLabels: true, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const regionBase = regionBaseLabels.find((label) => label.id === `label-region-${sampleRegion.id}`)
  const regionLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: false, showRegionLabels: true, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    regionLabelOverrides: reloadedRegion,
  })
  const regionLabel = regionLabels.find((label) => label.id === `label-region-${sampleRegion.id}`)
  check(
    'region-position-persist',
    regionLabel !== undefined &&
      Math.abs((regionLabel.x ?? 0) - ((regionBase?.x ?? 0) + regionOffsetX)) < 0.01 &&
      Math.abs((regionLabel.y ?? 0) - ((regionBase?.y ?? 0) + regionOffsetY)) < 0.01,
    `x=${regionLabel?.x}, y=${regionLabel?.y}`,
  )

  const emptyHydration = loadPersistedWorkplaceLabelOverrides(() => ({} as never))
  check(
    'empty-hydration-no-overwrite',
    Object.keys(emptyHydration).length === 0,
    `${Object.keys(emptyHydration).length} overrides`,
  )

  const persistedWithText = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      displayText: 'Vlastní\nNázev',
      offsetX: dragOffsetX,
      offsetY: dragOffsetY,
      manualPosition: true,
    },
  })
  const resetPositionOnly = mergeWorkplaceLabelOverrideMaps(persistedWithText, {
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      offsetX: undefined,
      offsetY: undefined,
      manualPosition: true,
      displayText: persistedWithText[sampleWorkplace.id]?.displayText,
    },
  })
  const sanitizedReset = sanitizeWorkplaceLabelOverrides(resetPositionOnly)
  check(
    'reset-position-keeps-text',
    sanitizedReset[sampleWorkplace.id]?.displayText === 'Vlastní\nNázev' &&
      sanitizedReset[sampleWorkplace.id]?.offsetX === undefined,
    JSON.stringify(sanitizedReset[sampleWorkplace.id]),
  )

  const orgResyncOverrides = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      offsetX: dragOffsetX,
      offsetY: dragOffsetY,
      manualPosition: true,
    },
  })
  const resyncMerged = mergeOrganizationSnapshots(seed, preview.incoming)
  const resyncWorkplaces = resyncMerged.workplaces.filter((wp) => !wp.absentFromSync)
  check(
    'org-resync-same-id',
    resyncWorkplaces.some((wp) => wp.id === sampleWorkplace.id),
    sampleWorkplace.id,
  )
  check(
    'org-resync-overrides-preserved',
    orgResyncOverrides[sampleWorkplace.id]?.offsetX === dragOffsetX,
    `${orgResyncOverrides[sampleWorkplace.id]?.offsetX}`,
  )

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const exportBase = exportLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  const exportWithOverrides = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: reloadedWorkplace,
  })
  const exportLabel = exportWithOverrides.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  check(
    'export-name-value-parity',
    exportLabel?.text === afterReload?.text && exportLabel?.valueText === afterReload?.valueText,
    exportLabel?.text ?? 'missing',
  )
  const exportDeltaX = (exportLabel?.x ?? 0) - (exportBase?.x ?? 0)
  const exportDeltaY = (exportLabel?.y ?? 0) - (exportBase?.y ?? 0)
  check(
    'export-offset-parity',
    Math.abs(exportDeltaX - dragOffsetX) < 0.01 && Math.abs(exportDeltaY - dragOffsetY) < 0.01,
    `delta=(${exportDeltaX},${exportDeltaY}) expected=(${dragOffsetX},${dragOffsetY})`,
  )

  const multilineOverrides = sanitizeWorkplaceLabelOverrides({
    [sampleWorkplace.id]: {
      workplaceId: sampleWorkplace.id,
      displayText: 'České\nBudějovice',
      offsetX: dragOffsetX,
      offsetY: dragOffsetY,
      manualPosition: true,
    },
  })
  const multilineLabels = buildMapLabels({
    resolver,
    territories,
    context,
    contentMode: 'name-value',
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
    workplaceLabelOverrides: multilineOverrides,
  })
  const multilineLabel = multilineLabels.find((label) => label.id === `label-workplace-${sampleWorkplace.id}`)
  const multilineRendered = multilineLabel ? buildRenderedMapLabel(multilineLabel) : null
  check(
    'multiline-name-plus-value',
    (multilineRendered?.nameLines.length ?? 0) === 2 &&
      Boolean(multilineRendered?.valueText && multilineLabel?.text.endsWith(multilineRendered.valueText)),
    multilineLabel?.text ?? 'missing',
  )

  const v2Payload = serializeWorkplaceLabelOverrides(reloadedWorkplace)
  check('storage-v2-version', v2Payload.version === 2, `${v2Payload.version}`)
  check(
    'storage-v2-key',
    WORKPLACE_LABEL_OVERRIDES_KEY.endsWith('-v2'),
    WORKPLACE_LABEL_OVERRIDES_KEY,
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-label-position-persistence ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
