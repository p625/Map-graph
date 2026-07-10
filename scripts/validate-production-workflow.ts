/**
 * Phase 5A.1 — validace produkčního workflow na testovacím datasetu.
 * Spuštění: npm run validate-production-workflow
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import { buildImportPreview } from '../src/domain/import/ImportPipeline.ts'
import { buildMapLabels } from '../src/domain/labels/labelEngine.ts'
import { mergeOrganizationSnapshots, parseAndPreviewSync, seedOrganizationFromWorkplaces } from '../src/domain/organization/organizationSync.ts'
import { buildTerritoryLayers } from '../src/domain/territory/territoryEngine.ts'
import { createWorkplaceResolver, hashAssignmentState } from '../src/domain/territory/workplaceResolver.ts'
import { categoricalPlugin } from '../src/domain/visualization/plugins/categoricalPlugin.ts'
import { choroplethPlugin } from '../src/domain/visualization/plugins/choroplethPlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { districts } from '../src/data/seed/districts.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const datasetPath = path.join(__dirname, '..', 'data', 'raw', 'production-test-opzl.csv')
const orgPath = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []

function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function loadCsvTable(filePath: string) {
  const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  const workbook = XLSX.read(text, { type: 'string' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)]),
    ),
  )
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : []
  return { headers, rows }
}

function computeMapAreaRatio(params: {
  width: number
  height: number
  showLegend: boolean
  showDatasetInfo: boolean
  title: string
  subtitle: string
}): number {
  const hasHeader = Boolean(params.title.trim() || params.subtitle.trim())
  const mapOnly = !params.showLegend && !params.showDatasetInfo && !hasHeader
  const padding = mapOnly ? Math.max(8, Math.round(params.width * 0.012)) : Math.round(params.width * 0.03)
  const headerHeight = hasHeader ? Math.round(params.height * 0.1) : 0
  const footerHeight = mapOnly ? 0 : Math.round(params.height * 0.04)
  const legendWidth = params.showLegend ? Math.round(params.width * 0.18) : 0
  const contentHeight = params.height - headerHeight - footerHeight - padding * (hasHeader ? 2 : 1)
  const mapWidth = params.width - padding * 2 - legendWidth - (params.showLegend ? padding : 0)
  const mapArea = mapWidth * contentHeight
  return mapArea / (params.width * params.height)
}

async function main() {
  const table = loadCsvTable(datasetPath)
  const datasetId = 'production-test'
  const preview = buildImportPreview(table, seedWorkplaces, datasetId)

  check('import-rows', preview.records.length === 67, `načteno ${preview.records.length} řádků`)
  check(
    'workplace-column',
    preview.workplaceColumn === 'Názvy OPŽL z LPIS',
    `sloupec pracoviště: ${preview.workplaceColumn}`,
  )

  const types = Object.fromEntries(preview.columns.map((c) => [c.name, c.type]))
  check('col-number-1', types['Počet žádostí'] === 'number', `Počet žádostí: ${types['Počet žádostí']}`)
  check('col-number-2', types['Vyřízeno ks'] === 'number', `Vyřízeno ks: ${types['Vyřízeno ks']}`)
  check('col-percent', types['Podíl vyřízení'] === 'percent', `Podíl: ${types['Podíl vyřízení']}`)
  check('col-text', types['Kategorie rizika'] === 'text', `Kategorie: ${types['Kategorie rizika']}`)

  const autoMatched = preview.matchedCount
  const unmatched = preview.records.filter((r) => !r.workplaceId)
  check('auto-match-majority', autoMatched >= 63, `automaticky spárováno ${autoMatched}/67`)
  check('unmatched-present', unmatched.length >= 2, `nespárované řádky: ${unmatched.length}`)

  const manualFixed = preview.records.map((record) => {
    if (record.workplaceId) return record
    if (record.rawLabel?.includes('Brno venkov')) {
      return { ...record, workplaceId: 'wp-003', matchStatus: 'manual' as const }
    }
    return record
  })
  const afterManual = manualFixed.filter((r) => r.workplaceId).length
  check('manual-fix', afterManual >= 64, `po ruční opravě spárováno ${afterManual}/67`)

  const workbook = await readWorkbook(orgPath)
  const orgRows = workbook.getSheetRows(0)
  const orgSeed = seedOrganizationFromWorkplaces()
  const orgPreview = parseAndPreviewSync(orgRows, orgSeed, 'organizace.xlsx')
  const orgMerged = mergeOrganizationSnapshots(orgSeed, orgPreview.incoming)

  const districtAssignments: Record<string, string> = {}
  for (const a of orgMerged.districtAssignments) districtAssignments[a.districtId] = a.workplaceId
  const regionalAssignments: Record<string, string> = {}
  for (const wp of orgMerged.workplaces) {
    if (!wp.absentFromSync && wp.regionId) regionalAssignments[wp.id] = wp.regionId
  }

  const syncedWorkplaces = orgMerged.workplaces
    .filter((w) => !w.absentFromSync)
    .map((w) => {
      const seed = seedWorkplaces.find((s) => s.id === w.id)
      return { id: w.id, code: seed?.code ?? w.id, name: w.name }
    })

  const vizContext: VisualizationContext = {
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: orgMerged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
    dataset: {
      id: datasetId,
      name: 'Production test',
      source: 'csv',
      importedAt: new Date().toISOString(),
      status: 'ready',
      columns: preview.columns,
      recordCount: preview.records.length,
      matchedCount: afterManual,
      unmatchedCount: preview.records.length - afterManual,
    },
    records: manualFixed.filter((r) => r.workplaceId),
    theme: classicTheme,
  }

  check('org-regions', orgMerged.regions.length === 7, `regionů: ${orgMerged.regions.length}`)
  check('org-leaders', orgMerged.leaders.length === 16, `vedoucích: ${orgMerged.leaders.length}`)

  const numberCol = preview.columns.find((c) => c.name === 'Počet žádostí')!
  const percentCol = preview.columns.find((c) => c.name === 'Podíl vyřízení')!
  const textCol = preview.columns.find((c) => c.name === 'Kategorie rizika')!

  const choroplethColors = choroplethPlugin.resolveColors({
    ...vizContext,
    column: numberCol,
  })
  const uniqueFills = new Set(Object.values(choroplethColors).map((s) => s.fill))
  check('choropleth-colors', uniqueFills.size >= 10, `choropleth odstínů: ${uniqueFills.size}`)
  check(
    'choropleth-nodata',
    Object.values(choroplethColors).some((s) => s.fill === classicTheme.noDataFill),
    'neutrální barva bez dat',
  )

  const percentLegend = choroplethPlugin.buildLegend({ ...vizContext, column: percentCol })
  check(
    'percent-legend-range',
    percentLegend.scale !== undefined && percentLegend.scale.max > percentLegend.scale.min,
    `percent rozsah ${percentLegend.scale?.min}–${percentLegend.scale?.max}`,
  )

  const catLegend = categoricalPlugin.buildLegend({ ...vizContext, column: textCol })
  check(
    'categorical-legend',
    catLegend.items.length >= 3,
    `kategorií v legendě: ${catLegend.items.length}`,
  )
  check(
    'categorical-no-data',
    catLegend.items.some((item) => item.label === 'Bez dat'),
    'legenda obsahuje Bez dat',
  )

  const assignmentHash = hashAssignmentState(districtAssignments, regionalAssignments)
  const resolver = createWorkplaceResolver({
    districts,
    workplaces: syncedWorkplaces,
    regionalOffices: orgMerged.regions.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: regionalAssignments,
  })
  const territories = buildTerritoryLayers({
    resolver,
    width: 1920,
    height: 1080,
    boundaryVisibility: { district: false, workplace: false, region: true },
    assignmentHash,
  })

  const valueLabels = buildMapLabels({
    resolver,
    territories,
    scope: 'workplace',
    width: 1920,
    height: 1080,
    assignmentHash,
    contentMode: 'value',
    context: { ...vizContext, column: numberCol },
  })
  check('labels-value-count', valueLabels.length === 65, `popisků hodnot: ${valueLabels.length}`)
  check(
    'labels-unique',
    new Set(valueLabels.map((l) => l.id)).size === valueLabels.length,
    'unikátní popisky pracovišť',
  )

  const mapOnlyRatio = computeMapAreaRatio({
    width: 1920,
    height: 1080,
    showLegend: false,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
  })
  check('export-map-only-area', mapOnlyRatio >= 0.9, `map-only plocha ${(mapOnlyRatio * 100).toFixed(1)} %`)

  const fullRatio = computeMapAreaRatio({
    width: 3508,
    height: 2480,
    showLegend: true,
    showDatasetInfo: true,
    title: 'Test',
    subtitle: 'A4',
  })
  check('export-a4-area', fullRatio >= 0.55, `A4 plocha mapy ${(fullRatio * 100).toFixed(1)} %`)

  console.log('=== VALIDACE PRODUKČNÍHO WORKFLOW (5A.1) ===\n')
  console.log(`Dataset: ${datasetPath}\n`)
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
