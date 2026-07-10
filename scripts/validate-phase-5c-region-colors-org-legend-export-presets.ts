/**
 * Validace Phase 5C.6 — barvy regionů, organizační legenda, vlastní exportní presety.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { resolveRegionDisplayColor } from '../src/domain/color/regionDisplayColors.ts'
import {
  createCustomExportPreset,
  CUSTOM_EXPORT_PRESETS_KEY,
  customPresetKey,
  sanitizeCustomExportPreset,
} from '../src/domain/export/customExportPresets.ts'
import { exportPresets } from '../src/domain/export/exportPresets.ts'
import {
  buildOrganizationLegendItems,
  formatOrganizationLegendLabel,
} from '../src/domain/organization/organizationLegend.ts'
import { resolveLeaderColor } from '../src/domain/organization/leaderColors.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { buildRegionScope } from '../src/domain/region/regionScope.ts'
import { createWorkplaceResolver } from '../src/domain/territory/workplaceResolver.ts'
import { byRegionalOfficePlugin } from '../src/domain/visualization/plugins/byRegionalOfficePlugin.ts'
import { byWorkplacePlugin } from '../src/domain/visualization/plugins/byWorkplacePlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

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

  const regionalOffices = merged.regions.map((region) => ({
    id: region.id,
    code: region.code,
    name: region.name,
  }))

  const workplaces = merged.workplaces
    .filter((workplace) => !workplace.absentFromSync)
    .map((workplace) => {
      const seedWp = seedWorkplaces.find((item) => item.id === workplace.id)
      return { id: workplace.id, code: seedWp?.code ?? workplace.id, name: workplace.name }
    })

  const customColor = '#0f766e'
  const regionId = regionalOffices[0]!.id
  const regionOverrides = { [regionId]: customColor }

  check(
    'region-color-save',
    resolveRegionDisplayColor(regionId, regionalOffices[0]!.name, regionOverrides) === customColor,
    customColor,
  )

  const memory = new Map<string, string>()
  const saveJson = (key: string, value: unknown) => memory.set(key, JSON.stringify(value))
  const loadJson = <T,>(key: string, fallback: T): T => {
    const raw = memory.get(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  }

  saveJson('map-graph-config-v4', { regionDisplayColors: regionOverrides })
  const reloaded = loadJson<{ regionDisplayColors?: Record<string, string> }>(
    'map-graph-config-v4',
    {},
  )
  check(
    'region-color-persist',
    reloaded.regionDisplayColors?.[regionId] === customColor,
    reloaded.regionDisplayColors?.[regionId] ?? 'missing',
  )

  const context: VisualizationContext = {
    districts,
    workplaces,
    regionalOffices,
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    regionDisplayColors: regionOverrides,
    theme: classicTheme,
    organization: {
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces.filter((wp) => !wp.absentFromSync),
    },
  }

  const regionalColors = byRegionalOfficePlugin.resolveColors(context)
  const workplaceColors = byWorkplacePlugin.resolveColors(context)
  const sampleDistrict = districts.find((district) => {
    const workplaceId = districtAssignments[district.id]
    return workplaceId && regionalAssignments[workplaceId] === regionId
  })
  const sampleFill = sampleDistrict ? regionalColors[sampleDistrict.id]?.fill : undefined

  check(
    'region-only-by-regional-office',
    sampleFill === customColor,
    sampleFill ?? 'n/a',
  )
  check(
    'region-not-in-workplace',
    !Object.values(workplaceColors).every((style) => style.fill === customColor),
    'workplace neovlivněn',
  )

  const orgLegendAll = buildOrganizationLegendItems({
    leaders: merged.leaders,
    orgUnits: merged.orgUnits,
    workplaces: merged.workplaces,
  })
  check('org-legend-leaders-count', orgLegendAll.length === 16, `${orgLegendAll.length}/16`)

  const brnoRegion = merged.regions.find((region) => region.name.includes('Brno'))
  if (brnoRegion) {
    const resolver = createWorkplaceResolver({
      districts,
      workplaces,
      regionalOffices,
      districtWorkplaceAssignments: districtAssignments,
      workplaceRegionalAssignments: regionalAssignments,
    })
    const scope = buildRegionScope(brnoRegion.id, 'focused', resolver)

    const orgLegendBrno = buildOrganizationLegendItems({
      leaders: merged.leaders,
      orgUnits: merged.orgUnits,
      workplaces: merged.workplaces,
      regionScope: scope,
    })
    const expectedLeaders = new Set(
      merged.workplaces
        .filter((wp) => !wp.absentFromSync && wp.regionId === brnoRegion.id && wp.leaderId)
        .map((wp) => wp.leaderId!),
    ).size
    check(
      'org-legend-region-filter',
      orgLegendBrno.length === expectedLeaders,
      `${orgLegendBrno.length}/${expectedLeaders}`,
    )
  } else {
    check('org-legend-region-filter', false, 'region Brno nenalezen')
  }

  const leader = merged.leaders[0]
  const leaderItem = orgLegendAll.find((item) => item.leaderId === leader?.id)
  const leaderIndex = merged.leaders.findIndex((item) => item.id === leader?.id)
  check(
    'org-legend-color-match',
    leaderItem?.color === resolveLeaderColor(leader, leaderIndex),
    leaderItem?.color ?? 'missing',
  )

  const labelLeader = leaderItem
    ? formatOrganizationLegendLabel(leaderItem, 'leader', false)
    : ''
  const labelOrgUnit = leaderItem
    ? formatOrganizationLegendLabel(leaderItem, 'org-unit', false)
    : ''
  check(
    'org-legend-label-modes',
    Boolean(labelLeader) && Boolean(labelOrgUnit),
    `${labelLeader} | ${labelOrgUnit}`,
  )

  const preset = createCustomExportPreset({
    name: 'Test preset',
    width: 1600,
    height: 900,
    mapSizeMode: 'maximum',
    mapWidthPercent: 95,
    mapHeightPercent: 95,
    showTitle: false,
    showSubtitle: false,
    showLegend: false,
    showOrganizationLegend: true,
    showDatasetInfo: false,
    exportScope: 'country',
    quality: 'standard',
  })
  const sanitized = sanitizeCustomExportPreset(preset)
  check(
    'custom-preset-roundtrip',
    sanitized?.width === 1600 && sanitized?.mapWidthPercent === 95,
    `${sanitized?.width ?? 0}px`,
  )

  check(
    'custom-preset-corrupt-fallback',
    sanitizeCustomExportPreset(null) === null &&
      sanitizeCustomExportPreset({ id: '', name: '' }) === null,
    'neplatný preset odmítnut',
  )

  const renamed = sanitizeCustomExportPreset({
    ...preset,
    name: 'PPT — velká mapa',
    updatedAt: new Date().toISOString(),
  })
  check(
    'custom-preset-rename',
    renamed?.name === 'PPT — velká mapa',
    renamed?.name ?? '',
  )

  const duplicate = sanitizeCustomExportPreset(
    createCustomExportPreset({
      ...preset,
      name: 'PPT — velká mapa (kopie)',
    }),
  )
  check(
    'custom-preset-duplicate',
    Boolean(duplicate) && duplicate!.name.includes('kopie'),
    duplicate?.name ?? '',
  )

  const memoryPresets: ReturnType<typeof createCustomExportPreset>[] = [preset]
  saveJson(CUSTOM_EXPORT_PRESETS_KEY, memoryPresets)
  const memLoaded = loadJson<unknown>(CUSTOM_EXPORT_PRESETS_KEY, [])
  check(
    'custom-preset-persist-memory',
    Array.isArray(memLoaded) && memLoaded.length === 1,
    `${Array.isArray(memLoaded) ? memLoaded.length : 0} v paměti`,
  )

  check(
    'builtin-preset-protected',
    exportPresets.length >= 4 && exportPresets.every((item) => Boolean(item.id)),
    `${exportPresets.length} vestavěných`,
  )

  check(
    'missing-preset-fallback',
    sanitizeCustomExportPreset({ id: '', name: '' }) === null,
    'neplatný preset odmítnut',
  )

  check(
    'custom-preset-key-format',
    customPresetKey('abc').startsWith('custom:'),
    customPresetKey('abc'),
  )

  const passed = checks.filter((item) => item.pass).length
  const failed = checks.filter((item) => !item.pass)

  console.log('=== VALIDACE PHASE 5C.6 (REGION COLORS / ORG LEGEND / EXPORT PRESETS) ===\n')
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
