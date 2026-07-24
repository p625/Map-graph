/**
 * Validace volného kompozičního exportního layoutu bez dělicí čáry (Phase 5F.3).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applyMapFullCanvasLayout,
  computeExportContentRect,
  DEFAULT_EXPORT_COMPOSITION_LAYOUT,
  getExportCompositionPreset,
  migrateLegacySplitExportLayout,
  resolveExportLegendRect,
  resolveExportMapRect,
  resolveLegendWidthForComposition,
  sanitizeExportCompositionLayout,
} from '../src/domain/export/exportCompositionLayout.ts'
import { computeExportLayout } from '../src/domain/export/exportMapLayout.ts'

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
  const canvas = { canvasWidth: 1920, canvasHeight: 1080 }
  const content = computeExportContentRect(canvas.canvasWidth, canvas.canvasHeight)
  const fullMap = applyMapFullCanvasLayout(DEFAULT_EXPORT_COMPOSITION_LAYOUT)
  const fullCtx = { ...canvas, composition: fullMap }

  check(
    'content-rect-full-width',
    content.width === canvas.canvasWidth - 24,
    `${content.width}px`,
  )
  check(
    'map-full-width-ratio',
    fullMap.map.xRatio === 0 && fullMap.map.widthRatio === 1,
    `x=${fullMap.map.xRatio} width=${fullMap.map.widthRatio}`,
  )

  const mapRect = resolveExportMapRect(fullCtx)
  const mapAreaRatio = (mapRect.width * mapRect.height) / (content.width * content.height)
  check(
    'full-map-maximizes-content',
    mapAreaRatio >= 0.85,
    `area=${(mapAreaRatio * 100).toFixed(1)}% map=${mapRect.width}x${mapRect.height}`,
  )

  const withLegend = sanitizeExportCompositionLayout({
    ...fullMap,
    organizationalLegend: {
      ...fullMap.organizationalLegend,
      visible: true,
      xRatio: 0.1,
      yRatio: 0.2,
      widthRatio: 0.35,
    },
  })
  const withLegendCtx = { ...canvas, composition: withLegend }
  const mapWithLegend = resolveExportMapRect(withLegendCtx)
  check(
    'legend-toggle-does-not-shrink-map',
    mapWithLegend.width === mapRect.width,
    `${mapWithLegend.width} vs ${mapRect.width}`,
  )

  const legendWidth = resolveLegendWidthForComposition(withLegendCtx)
  const legendRect = resolveExportLegendRect(withLegendCtx, legendWidth, 240)
  check(
    'legend-inside-content-rect',
    legendRect.x >= content.x &&
      legendRect.y >= content.y &&
      legendRect.x + legendWidth <= content.x + content.width + 1,
    `x=${legendRect.x} width=${legendWidth}`,
  )
  check(
    'legend-can-overlay-map',
    legendRect.x < mapWithLegend.x + mapWithLegend.width,
    `legendX=${legendRect.x} mapRight=${mapWithLegend.x + mapWithLegend.width}`,
  )

  const splitPreset = getExportCompositionPreset('map-right-legend-left')
  check(
    'split-preset-no-legacy-fields',
    !('divider' in splitPreset) && !('splitLayout' in splitPreset),
    splitPreset.presetId,
  )

  const migrated = sanitizeExportCompositionLayout(
    migrateLegacySplitExportLayout({
      divider: true,
      splitLayout: true,
      reservedLegendWidth: 420,
      mapColumnWidth: 560,
      presetId: 'custom',
    }),
  )
  check(
    'legacy-split-migration-loads',
    migrated.presetId === 'custom' && migrated.map.widthRatio > 0,
    `widthRatio=${migrated.map.widthRatio}`,
  )
  check(
    'legacy-migration-removes-divider-fields',
    !('divider' in migrated),
    'divider stripped',
  )

  const metricsWithLegend = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: true,
    showDatasetInfo: false,
    title: 'Test',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })
  const metricsWithoutLegend = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: false,
    showDatasetInfo: false,
    title: 'Test',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })
  check(
    'no-reserved-legend-column',
    metricsWithLegend.legendWidth === 0 &&
      metricsWithLegend.mapWidth === metricsWithoutLegend.mapWidth,
    `legendWidth=${metricsWithLegend.legendWidth} mapWidth=${metricsWithLegend.mapWidth}`,
  )

  const canvasSource = readFileSync(
    join(process.cwd(), 'src/components/map/export/ExportCompositionCanvas.tsx'),
    'utf8',
  )
  check(
    'preview-no-vertical-divider',
    !canvasSource.includes("borderLeft: '1px solid #e2e8f0'"),
    'borderLeft divider removed',
  )
  check(
    'data-legend-is-overlay',
    canvasSource.includes('export-data-legend') &&
      canvasSource.includes('backgroundColor:'),
    'floating data legend overlay',
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-export-free-layout ===\n')
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
