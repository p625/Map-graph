/**
 * Validace exportního layoutu mapy včetně mapové plochy a legendy.
 */
import { computeExportLayout } from '../src/domain/export/exportMapLayout.ts'
import { resolveExportOrganizationLegendLayout } from '../src/domain/organization/exportOrganizationLegendLayout.ts'
import { DEFAULT_ORGANIZATION_LEGEND_LAYOUT } from '../src/domain/organization/organizationLegendLayout.ts'

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function main() {
  const presentation = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: true,
    showDatasetInfo: true,
    title: 'Test',
    subtitle: '',
    sizing: { mode: 'balanced', mapAreaPercent: 78 },
  })

  check(
    'export-map-area-positive',
    presentation.mapWidth > 0 && presentation.mapHeight > 0,
    `${presentation.mapWidth}x${presentation.mapHeight}`,
  )

  check(
    'export-map-area-smaller-than-canvas',
    presentation.mapWidth < 1920 && presentation.mapHeight < 1080,
    `${presentation.mapWidth}x${presentation.mapHeight}`,
  )

  const mapOnly = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: false,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })

  check('map-only-mode', mapOnly.mapOnly, String(mapOnly.mapOnly))
  check(
    'map-only-large-area',
    mapOnly.mapAreaRatio >= 0.9,
    `${(mapOnly.mapAreaRatio * 100).toFixed(1)}%`,
  )

  const resolved = resolveExportOrganizationLegendLayout(
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
    { inheritFromEditor: true, layout: null },
    { width: mapOnly.mapWidth, height: mapOnly.mapHeight },
    DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
  )

  check(
    'org-legend-resolves-for-export-map',
    resolved.width > 0 && resolved.height > 0,
    `${resolved.width}x${resolved.height}`,
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-map-export ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main()
