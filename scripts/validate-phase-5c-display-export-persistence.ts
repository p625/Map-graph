/**
 * Validace Phase 5C.5 — barvy pracovišť, popisky, export, persistence datasetů.
 */
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { resolveWorkplaceDisplayColor } from '../src/domain/color/workplaceDisplayColors.ts'
import { computeExportLayout } from '../src/domain/export/exportMapLayout.ts'
import {
  buildMapLabels,
  DEFAULT_MAP_LABEL_STYLE,
  type MapLabel,
} from '../src/domain/labels/labelEngine.ts'
import { byWorkplacePlugin } from '../src/domain/visualization/plugins/byWorkplacePlugin.ts'
import { byDistrictPlugin } from '../src/domain/visualization/plugins/byDistrictPlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import { estimateJsonBytes, isDatasetStateValid, LOCAL_STORAGE_SOFT_LIMIT_BYTES } from '../src/utils/storage.ts'
import type { Dataset } from '../src/domain/types/dataset.ts'
import type { DatasetRecord } from '../src/domain/types/datasetRecord.ts'

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
  const lines = label.text.split('\n').length
  const longestLine = label.text.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
  const charWidth = label.fontSize * 0.52
  const width = Math.min(label.style.maxWidth, longestLine * charWidth + 4)
  const height = label.fontSize * (1.15 * lines + 0.2)
  return {
    x: label.x - width / 2,
    y: label.y - height / 2,
    width,
    height,
  }
}

function boxesFullyOverlap(a: ReturnType<typeof estimateLabelBox>, b: ReturnType<typeof estimateLabelBox>): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX <= 0 || overlapY <= 0) return false
  const overlapArea = overlapX * overlapY
  const minArea = Math.min(a.width * a.height, b.width * b.height)
  return overlapArea >= minArea * 0.85
}

function buildTestContext(overrides: Record<string, string> = {}): VisualizationContext {
  const districtWorkplaceAssignments: Record<string, string> = {}
  for (const district of districts) {
    const wp = seedWorkplaces.find((w) =>
      district.name.toLowerCase().includes(w.name.toLowerCase().split(' ')[0] ?? ''),
    )
    if (wp) districtWorkplaceAssignments[district.id] = wp.id
  }

  return {
    districts,
    workplaces: seedWorkplaces,
    regionalOffices: [],
    districtWorkplaceAssignments,
    workplaceRegionalAssignments: {},
    workplaceDisplayColors: overrides,
    theme: classicTheme,
  }
}

async function main() {
  const memory = new Map<string, string>()
  const saveJson = (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value))
    return { ok: true as const, bytes: memory.get(key)?.length }
  }
  const loadJson = <T,>(key: string, fallback: T): T => {
    const raw = memory.get(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  }

  const customColor = '#c2410c'
  const workplaceId = seedWorkplaces[0]!.id
  const overrides = { [workplaceId]: customColor }

  check(
    'workplace-color-save',
    resolveWorkplaceDisplayColor(workplaceId, seedWorkplaces[0]!.name, overrides) === customColor,
    customColor,
  )

  saveJson('test-workplace-colors', { [workplaceId]: customColor })
  const reloaded = loadJson<Record<string, string>>('test-workplace-colors', {})
  check(
    'workplace-color-persist',
    reloaded[workplaceId] === customColor,
    reloaded[workplaceId] ?? 'missing',
  )

  const context = buildTestContext(overrides)
  const workplaceColors = byWorkplacePlugin.resolveColors(context)
  const districtColors = byDistrictPlugin.resolveColors({
    ...context,
    districtDisplayColors: { [districts[0]!.id]: '#ff00ff' },
  })

  check(
    'workplace-only-by-workplace',
    Object.values(workplaceColors).some((style) => style.fill === customColor),
    'custom barva v by-workplace',
  )
  check(
    'workplace-not-in-district',
    !Object.values(districtColors).every((style) => style.fill === '#ff00ff'),
    'district neovlivněn',
  )

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: seedWorkplaces,
    regionalOffices: [
      { id: 'region-praha', code: 'praha', name: 'Praha' },
      { id: 'region-brno', code: 'brno', name: 'Brno' },
    ],
    districtWorkplaceAssignments: context.districtWorkplaceAssignments,
    workplaceRegionalAssignments: { [seedWorkplaces[0]!.id]: 'region-praha' },
  })
  const assignmentHash = hashAssignmentState(context.districtWorkplaceAssignments, {})
  const territories = buildTerritoryLayers({
    resolver,
    width: 760,
    height: 460,
    boundaryVisibility: { district: false, workplace: false, region: false },
    assignmentHash,
  })

  const labels = buildMapLabels({
    resolver,
    territories,
    scope: 'workplace',
    width: 760,
    height: 460,
    assignmentHash,
    labelSizePreset: 'small',
    labelHaloEnabled: false,
  })
  const visibleLabels = labels.filter((label) => label.visible)
  const maxFont = Math.max(...visibleLabels.map((label) => label.style.fontSizePx), 0)

  check('label-font-smaller', maxFont <= 24, `max font ${maxFont}px`)
  check(
    'label-halo-off-default',
    DEFAULT_MAP_LABEL_STYLE.haloEnabled === false,
    `halo=${DEFAULT_MAP_LABEL_STYLE.haloEnabled}`,
  )
  const workplacesWithDistricts = resolver.workplaces.filter(
    (workplace) => resolver.getDistrictIdsForWorkplace(workplace.id).length > 0,
  ).length
  check(
    'labels-all-workplaces-visible',
    visibleLabels.length === workplacesWithDistricts,
    `${visibleLabels.length}/${workplacesWithDistricts} viditelných`,
  )
  check(
    'labels-unique-visible',
    new Set(visibleLabels.map((label) => label.text)).size === visibleLabels.length,
    `${visibleLabels.length} popisků`,
  )

  let fullOverlap = false
  for (let i = 0; i < visibleLabels.length; i += 1) {
    for (let j = i + 1; j < visibleLabels.length; j += 1) {
      if (boxesFullyOverlap(estimateLabelBox(visibleLabels[i]!), estimateLabelBox(visibleLabels[j]!))) {
        fullOverlap = true
      }
    }
  }
  check('labels-no-full-overlap', !fullOverlap, 'žádné plné překrytí')

  const mapOnly = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: false,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 95 },
  })
  check(
    'export-map-only-ratio',
    mapOnly.mapAreaRatio >= 0.95,
    `${(mapOnly.mapAreaRatio * 100).toFixed(1)} %`,
  )

  const withLegend = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: true,
    showDatasetInfo: false,
    title: 'Test',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })
  check(
    'export-legend-ratio',
    withLegend.mapAreaRatio >= 0.75,
    `${(withLegend.mapAreaRatio * 100).toFixed(1)} %`,
  )

  const a4Landscape = computeExportLayout({
    width: 3508,
    height: 2480,
    showLegend: true,
    showDatasetInfo: true,
    title: 'Test',
    subtitle: 'Poznámka',
    sizing: { mode: 'balanced', mapAreaPercent: 78 },
  })
  check(
    'export-a4-landscape-ratio',
    a4Landscape.mapAreaRatio >= 0.7,
    `${(a4Landscape.mapAreaRatio * 100).toFixed(1)} %`,
  )

  const customExport = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: true,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
    sizing: { mode: 'custom', mapAreaPercent: 90 },
  })
  check(
    'export-custom-applied',
    customExport.mapAreaRatio >= 0.85,
    `${(customExport.mapAreaRatio * 100).toFixed(1)} %`,
  )

  const dataset: Dataset = {
    id: 'test-ds',
    name: 'Test dataset',
    status: 'ready',
    columns: [{ id: 'col-value', key: 'value', name: 'Hodnota', type: 'number', nullable: false }],
    recordCount: 2,
    matchedCount: 2,
    unmatchedCount: 0,
    importedAt: new Date().toISOString(),
    source: 'manual',
  }
  const records: DatasetRecord[] = [
    {
      id: 'r1',
      datasetId: 'test-ds',
      workplaceId: seedWorkplaces[0]!.id,
      matchStatus: 'matched',
      values: { value: 10 },
      rawLabel: seedWorkplaces[0]!.name,
    },
    {
      id: 'r2',
      datasetId: 'test-ds',
      workplaceId: seedWorkplaces[1]!.id,
      matchStatus: 'matched',
      values: { value: 20 },
      rawLabel: seedWorkplaces[1]!.name,
    },
  ]

  const datasetState = { datasets: [dataset], recordsByDataset: { 'test-ds': records } }
  saveJson('map-graph-datasets-v2-test', datasetState)
  const loaded = loadJson<typeof datasetState | null>('map-graph-datasets-v2-test', null)
  check(
    'dataset-persist-roundtrip',
    isDatasetStateValid(loaded) &&
      loaded.datasets.length === 1 &&
      loaded.recordsByDataset['test-ds']?.length === 2,
    `datasets=${isDatasetStateValid(loaded) ? loaded.datasets.length : 0}`,
  )

  const emptyOverwrite = loadJson('map-graph-datasets-v2', { datasets: [], recordsByDataset: {} })
  check(
    'dataset-empty-not-valid-overwrite',
    !isDatasetStateValid(emptyOverwrite) || emptyOverwrite.datasets.length === 0,
    'prázdný stav validní jen jako prázdný',
  )

  const bytes = estimateJsonBytes(datasetState)
  check('dataset-size-estimate', bytes > 0 && bytes < LOCAL_STORAGE_SOFT_LIMIT_BYTES, `${bytes} B`)

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE PHASE 5C.5 (DISPLAY / EXPORT / PERSISTENCE) ===\n')
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
