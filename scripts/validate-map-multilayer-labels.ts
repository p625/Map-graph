/**
 * Validace vícevrstvých popisků mapy, fontů, kolizí a řazení organizační legendy.
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
  DEFAULT_LABEL_FONT_SIZES,
  sanitizeLabelFontSizes,
  sanitizeLabelVisibility,
} from '../src/domain/labels/labelSettings.ts'
import {
  buildOrganizationLegendItems,
  compareOrgUnitDesignations,
  distributeLegendItemsRowMajor,
} from '../src/domain/organization/organizationLegend.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { filterLabelsForRegion } from '../src/domain/region/regionFocus.ts'
import { buildRegionScope } from '../src/domain/region/regionScope.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import {
  createWorkplaceResolver,
  hashAssignmentState,
} from '../src/domain/territory/workplaceResolver.ts'
import {
  templateFontSizesToDomain,
  templateVisibilityToDomain,
} from '../src/domain/export/mapTemplates.ts'
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

function boxesOverlap(a: ReturnType<typeof estimateLabelBox>, b: ReturnType<typeof estimateLabelBox>, gap = 2) {
  return !(
    a.x + a.width + gap < b.x ||
    b.x + b.width + gap < a.x ||
    a.y + a.height + gap < b.y ||
    b.y + b.height + gap < a.y
  )
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

  const regionalOffices = merged.regions.map((region) => ({
    id: region.id,
    code: region.code,
    name: region.name,
  }))

  const resolver = createWorkplaceResolver({
    districts,
    workplaces: activeWorkplaces,
    regionalOffices,
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

  const multiLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: {
      showWorkplaceLabels: true,
      showRegionLabels: true,
      showDistrictLabels: false,
    },
    labelFontSizes: {
      workplaceFontSizePx: 8,
      regionFontSizePx: 14,
      districtFontSizePx: 7,
    },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
  })

  const regionLabels = multiLabels.filter((label) => label.level === 'region' && label.visible)
  const workplaceLabels = multiLabels.filter((label) => label.level === 'workplace' && label.visible)

  check(
    'multilayer-workplace-and-region',
    regionLabels.length > 0 && workplaceLabels.length > 0,
    `region=${regionLabels.length}, workplace=${workplaceLabels.length}`,
  )
  check(
    'region-label-count-cr',
    regionLabels.length === regionalOffices.length,
    `${regionLabels.length}/${regionalOffices.length}`,
  )
  check(
    'workplace-label-count-cr',
    workplaceLabels.length === activeWorkplaces.length,
    `${workplaceLabels.length}/${activeWorkplaces.length}`,
  )

  const uniqueIds = new Set(multiLabels.map((label) => label.id))
  check(
    'label-unique-ids',
    uniqueIds.size === multiLabels.length,
    `${uniqueIds.size} unikátních ID`,
  )

  const brnoRegion = merged.regions.find((region) => region.name.includes('Brno'))
  if (brnoRegion) {
    const scope = buildRegionScope(brnoRegion.id, 'focused', resolver)
    const filtered = filterLabelsForRegion(multiLabels, scope)
    const expectedWorkplaces = activeWorkplaces.filter(
      (workplace) => regionalAssignments[workplace.id] === brnoRegion.id,
    ).length
    const visibleWorkplaces = filtered.filter(
      (label) => label.level === 'workplace' && label.visible,
    ).length
    const visibleRegions = filtered.filter(
      (label) => label.level === 'region' && label.visible,
    ).length
    check(
      'region-focus-workplace-count',
      visibleWorkplaces === expectedWorkplaces,
      `${visibleWorkplaces}/${expectedWorkplaces}`,
    )
    check(
      'region-focus-region-count',
      visibleRegions === 1,
      `${visibleRegions}/1`,
    )
  } else {
    check('region-focus-workplace-count', false, 'region Brno nenalezen')
    check('region-focus-region-count', false, 'region Brno nenalezen')
  }

  const workplaceSized = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: false },
    labelFontSizes: { workplaceFontSizePx: 10, regionFontSizePx: 18, districtFontSizePx: 7 },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const regionFontSizes = workplaceSized
    .filter((label) => label.level === 'region')
    .map((label) => label.style.fontSizePx)
  const workplaceFontSizes = workplaceSized
    .filter((label) => label.level === 'workplace')
    .map((label) => label.style.fontSizePx)

  check(
    'independent-region-font-size',
    regionFontSizes.every((size) => size === 18),
    `region=${regionFontSizes[0] ?? 0}px`,
  )
  check(
    'independent-workplace-font-size',
    workplaceFontSizes.every((size) => size === 10),
    `workplace=${workplaceFontSizes[0] ?? 0}px`,
  )
  check(
    'workplace-font-change-not-region',
    regionFontSizes.every((size) => size === 18) && workplaceFontSizes.every((size) => size === 10),
    'nezávislé velikosti',
  )

  const exportLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: false },
    labelFontSizes: { workplaceFontSizePx: 9, regionFontSizePx: 16, districtFontSizePx: 7 },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const exportRegions = exportLabels.filter((label) => label.level === 'region')
  const exportWorkplaces = exportLabels.filter((label) => label.level === 'workplace')
  check(
    'export-same-label-counts',
    exportRegions.length === regionalOffices.length &&
      exportWorkplaces.length === activeWorkplaces.length,
    `region=${exportRegions.length}, workplace=${exportWorkplaces.length}`,
  )
  check(
    'export-same-font-sizes',
    exportRegions.every((label) => label.style.fontSizePx === 16) &&
      exportWorkplaces.every((label) => label.style.fontSizePx === 9),
    'export font sizes OK',
  )

  const collisionLabels = buildMapLabels({
    resolver,
    territories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: true },
    labelFontSizes: DEFAULT_LABEL_FONT_SIZES,
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    labelHideOnCollision: true,
  })
  const hiddenRegions = collisionLabels.filter((label) => label.level === 'region' && !label.visible)
  const hiddenWorkplaces = collisionLabels.filter(
    (label) => label.level === 'workplace' && !label.visible,
  )
  check(
    'collision-priority-region-visible',
    hiddenRegions.length === 0,
    `skrytých regionů: ${hiddenRegions.length}`,
  )
  check(
    'collision-priority-workplace-visible',
    hiddenWorkplaces.length === 0,
    `skrytých pracovišť: ${hiddenWorkplaces.length}`,
  )

  const visibleRegionsForCollision = collisionLabels.filter(
    (label) => label.level === 'region' && label.visible,
  )
  const visibleWorkplacesForCollision = collisionLabels.filter(
    (label) => label.level === 'workplace' && label.visible,
  )
  let regionHiddenByWorkplace = 0
  for (const regionLabel of visibleRegionsForCollision) {
    const regionBox = estimateLabelBox(regionLabel)
    for (const workplaceLabel of visibleWorkplacesForCollision) {
      const workplaceBox = estimateLabelBox(workplaceLabel)
      if (boxesOverlap(regionBox, workplaceBox)) {
        regionHiddenByWorkplace += 1
      }
    }
  }
  check(
    'region-not-hidden-by-workplace-collision',
    regionHiddenByWorkplace === 0 || hiddenRegions.length === 0,
    `kolizí region↔workplace: ${regionHiddenByWorkplace}, skryté regiony: ${hiddenRegions.length}`,
  )

  const orgLegendAll = buildOrganizationLegendItems({
    leaders: merged.leaders,
    orgUnits: merged.orgUnits,
    workplaces: merged.workplaces,
  })
  const designations = orgLegendAll.map((item) => item.orgUnitDesignation).filter(Boolean)
  const sortedDesignations = [...designations].sort(compareOrgUnitDesignations)
  check(
    'org-legend-sorted-by-designation',
    designations.join(',') === sortedDesignations.join(','),
    designations.slice(0, 4).join(', '),
  )
  check(
    'org-legend-natural-sort',
    compareOrgUnitDesignations('S1112', 'S11110') < 0,
    'S1112 před S11110',
  )

  const rowMajor = distributeLegendItemsRowMajor(
    ['S11101', 'S11102', 'S11103', 'S11104'],
    2,
  )
  check(
    'org-legend-row-major-columns',
    rowMajor[0].join(',') === 'S11101,S11103' && rowMajor[1].join(',') === 'S11102,S11104',
    `${rowMajor[0].join('|')} // ${rowMajor[1].join('|')}`,
  )

  const migratedVisibility = sanitizeLabelVisibility(undefined, 'workplace')
  check(
    'legacy-scope-migration-workplace',
    migratedVisibility.showWorkplaceLabels && !migratedVisibility.showRegionLabels,
    JSON.stringify(migratedVisibility),
  )
  const migratedFonts = sanitizeLabelFontSizes(undefined, 12)
  check(
    'legacy-font-migration',
    migratedFonts.workplaceFontSizePx === 12 &&
      migratedFonts.regionFontSizePx === DEFAULT_LABEL_FONT_SIZES.regionFontSizePx,
    JSON.stringify(migratedFonts),
  )

  const templateVisibility = templateVisibilityToDomain(undefined, 'region')
  const templateFonts = templateFontSizesToDomain(undefined)
  check(
    'template-legacy-migration',
    templateVisibility.showRegionLabels && templateFonts.districtFontSizePx === 7,
    'stará šablona bez pádu',
  )

  check(
    'legacy-sanitize-font',
    sanitizeLabelFontSizePx(0) === 8 && sanitizeLabelFontSizePx(99) === 24,
    '0→8, 99→24',
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE MAP MULTILAYER LABELS ===\n')
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
