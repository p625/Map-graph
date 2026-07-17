/**
 * Validace halo, legendy, region focus a resize layoutu.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import {
  buildMapLabels,
  DEFAULT_LABEL_HALO_SETTINGS,
  sanitizeLabelHaloSettings,
} from '../src/domain/labels/labelEngine.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import {
  buildOrganizationLegendItems,
  compareOrgUnitDesignations,
} from '../src/domain/organization/organizationLegend.ts'
import {
  computeAutoColumnCount,
  DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
  distributeItemsRowMajor,
  resolveOrganizationLegendSegments,
  sanitizeOrganizationLegendLayout,
} from '../src/domain/organization/organizationLegendLayout.ts'
import { filterLabelsForRegion, filterTerritoryLayersForExport } from '../src/domain/region/regionFocus.ts'
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
  const fullTerritories = buildTerritoryLayers({
    resolver,
    width: WIDTH,
    height: HEIGHT,
    boundaryVisibility: { district: false, workplace: false, region: false },
    assignmentHash,
  })

  const workplaceHalo = buildMapLabels({
    resolver,
    territories: fullTerritories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
    labelHaloSettings: {
      ...DEFAULT_LABEL_HALO_SETTINGS,
      workplace: { enabled: true, color: '#fef3c7', widthPx: 2 },
    },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  const regionHalo = buildMapLabels({
    resolver,
    territories: fullTerritories,
    labelVisibility: { showWorkplaceLabels: false, showRegionLabels: true, showDistrictLabels: false },
    labelHaloSettings: {
      ...DEFAULT_LABEL_HALO_SETTINGS,
      region: { enabled: true, color: '#dbeafe', widthPx: 3 },
    },
    width: WIDTH,
    height: HEIGHT,
    assignmentHash,
    disableCollisionAvoidance: true,
  })

  const wpStyle = workplaceHalo.find((label) => label.level === 'workplace')?.style
  const rgStyle = regionHalo.find((label) => label.level === 'region')?.style
  check('workplace-halo-independent', wpStyle?.haloEnabled === true && wpStyle.haloColor === '#fef3c7', `${wpStyle?.haloColor}`)
  check('region-halo-independent', rgStyle?.haloEnabled === true && rgStyle.haloColor === '#dbeafe', `${rgStyle?.haloColor}`)
  check(
    'halo-change-isolation',
    wpStyle?.haloColor !== rgStyle?.haloColor,
    `${wpStyle?.haloColor} vs ${rgStyle?.haloColor}`,
  )

  const migrated = sanitizeLabelHaloSettings(undefined, true)
  check('legacy-halo-migration', migrated.workplace.enabled === true, JSON.stringify(migrated.workplace))

  for (const widthPx of [0, 1, 3]) {
    const sized = buildMapLabels({
      resolver,
      territories: fullTerritories,
      labelVisibility: { showWorkplaceLabels: true, showRegionLabels: false, showDistrictLabels: false },
      labelHaloSettings: {
        ...DEFAULT_LABEL_HALO_SETTINGS,
        workplace: { enabled: widthPx > 0, color: '#fff', widthPx },
      },
      width: WIDTH,
      height: HEIGHT,
      assignmentHash,
      disableCollisionAvoidance: true,
    })
    const style = sized[0]?.style
    check(`halo-width-${widthPx}`, style?.haloWidth === (widthPx > 0 ? widthPx : 0), `${style?.haloWidth}`)
  }

  const exportLabels = buildMapLabels({
    resolver,
    territories: fullTerritories,
    labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: false },
    labelHaloSettings: {
      workplace: { enabled: true, color: '#f8fafc', widthPx: 1.5 },
      region: { enabled: true, color: '#e2e8f0', widthPx: 2 },
      district: DEFAULT_LABEL_HALO_SETTINGS.district,
    },
    width: 1920,
    height: 1080,
    assignmentHash,
    disableCollisionAvoidance: true,
  })
  check(
    'export-halo-same-width',
    exportLabels.some((label) => label.level === 'workplace' && label.style.haloWidth === 1.5),
    'export workplace halo',
  )

  const orgItems = buildOrganizationLegendItems({
    leaders: merged.leaders,
    orgUnits: merged.orgUnits,
    workplaces: merged.workplaces,
  })
  const sorted = [...orgItems].sort((a, b) => {
    const d = compareOrgUnitDesignations(a.orgUnitDesignation, b.orgUnitDesignation)
    if (d !== 0) return d
    return a.leaderName.localeCompare(b.leaderName, 'cs')
  })
  check(
    'org-legend-s-code-order',
    orgItems.map((item) => item.orgUnitDesignation).join(',') ===
      sorted.map((item) => item.orgUnitDesignation).join(','),
    orgItems.slice(0, 3).map((item) => item.orgUnitDesignation).join(', '),
  )

  const segment = resolveOrganizationLegendSegments(orgItems[0], 'leader-org-unit', false)
  check(
    'org-legend-segment-order',
    segment.showDesignation && segment.showLeader,
    `${segment.designation} ${segment.leaderName}`,
  )

  const narrowLayout = sanitizeOrganizationLegendLayout({ ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT, width: 140 })
  const wideLayout = sanitizeOrganizationLegendLayout({ ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT, width: 520 })
  const narrowCols = computeAutoColumnCount(narrowLayout, orgItems, 'leader-org-unit', false)
  const wideCols = computeAutoColumnCount(wideLayout, orgItems, 'leader-org-unit', false)
  check('legend-resize-more-columns', wideCols >= narrowCols, `${narrowCols} → ${wideCols}`)

  const rowMajor = distributeItemsRowMajor(['A', 'B', 'C', 'D'], 2)
  check('legend-row-major', rowMajor.join('') === 'ABCD', rowMajor.join('|'))

  const biggerFontLayout = sanitizeOrganizationLegendLayout({
    ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
    width: 300,
    fontSizePx: 14,
  })
  const smallerFontLayout = sanitizeOrganizationLegendLayout({
    ...DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
    width: 300,
    fontSizePx: 8,
  })
  const colsBigFont = computeAutoColumnCount(biggerFontLayout, orgItems, 'leader-org-unit', false)
  const colsSmallFont = computeAutoColumnCount(smallerFontLayout, orgItems, 'leader-org-unit', false)
  check('legend-font-affects-columns', colsSmallFont >= colsBigFont, `${colsBigFont} vs ${colsSmallFont}`)

  for (const region of merged.regions) {
    const scope = buildRegionScope(region.id, 'focused', resolver)
    const filteredPolygons = filterTerritoryLayersForExport(fullTerritories.fillPolygons, scope)
    const outside = filteredPolygons.some((polygon) => !scope.districtIds.has(polygon.entityId))
    const expectedCount = scope.districtIds.size
    check(
      `region-focus-polygons-${region.code}`,
      !outside && filteredPolygons.length === expectedCount,
      `${filteredPolygons.length}/${expectedCount}`,
    )

    const allLabels = buildMapLabels({
      resolver,
      territories: fullTerritories,
      labelVisibility: { showWorkplaceLabels: true, showRegionLabels: true, showDistrictLabels: true },
      width: WIDTH,
      height: HEIGHT,
      assignmentHash,
      disableCollisionAvoidance: true,
    })
    const focusedLabels = filterLabelsForRegion(allLabels, scope)
    const leak = focusedLabels.some((label) => {
      if (label.level === 'region') return label.id !== `label-region-${region.id}`
      if (label.level === 'workplace') {
        const workplaceId = label.id.replace(/^label-workplace-/, '')
        return !scope.workplaceIds.has(workplaceId)
      }
      if (label.level === 'district') {
        const districtId = label.id.replace(/^label-district-/, '')
        return !scope.districtIds.has(districtId)
      }
      return false
    })
    check(`region-focus-labels-${region.code}`, !leak, `${focusedLabels.length} popisků`)
  }

  const brno = merged.regions.find((region) => region.name.includes('Brno'))
  if (brno) {
    const scope = buildRegionScope(brno.id, 'focused', resolver)
    const orgScoped = buildOrganizationLegendItems({
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces,
      regionScope: scope,
    })
    const leak = orgScoped.some((item) =>
      merged.workplaces.some(
        (wp) =>
          wp.leaderId === item.leaderId && wp.regionId && wp.regionId !== brno.id && !wp.absentFromSync,
      ),
    )
    check('region-focus-org-legend-filter', !leak, `${orgScoped.length} položek`)
  }

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE REGION / HALO / LEGEND / FOCUS ===\n')
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
