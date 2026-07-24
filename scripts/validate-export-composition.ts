/**
 * Validace kompozičního exportního editoru (Phase 5F.2).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_EXPORT_COMPOSITION_LAYOUT,
  computeExportContentRect,
  getExportCompositionPreset,
  resolveExportMapRect,
  resolveExportTitleRect,
  resolveLegendWidthForComposition,
  sanitizeExportCompositionLayout,
} from '../src/domain/export/exportCompositionLayout.ts'

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
  const topRight = getExportCompositionPreset('map-top-right')
  const ctx = { ...canvas, composition: topRight }

  const mapRect = resolveExportMapRect(ctx)
  const titleRect = resolveExportTitleRect(ctx)
  const legendWidth = resolveLegendWidthForComposition(ctx)

  check(
    'top-right-map-preset-exists',
    topRight.presetId === 'map-top-right',
    topRight.presetId,
  )
  check(
    'map-placed-right-side',
    mapRect.x + mapRect.width <= canvas.canvasWidth - 12,
    `x=${mapRect.x} width=${mapRect.width}`,
  )
  check(
    'map-top-right-position',
    mapRect.x + mapRect.width > canvas.canvasWidth * 0.7,
    `right=${mapRect.x + mapRect.width}`,
  )
  check(
    'legend-left-of-map',
    legendWidth > 0 && topRight.organizationalLegend.xRatio < topRight.map.xRatio,
    `${topRight.organizationalLegend.xRatio} vs ${topRight.map.xRatio}`,
  )
  check(
    'title-visible-top',
    titleRect.y < mapRect.y + 20,
    `titleY=${titleRect.y}`,
  )
  check(
    'content-scale-default',
    DEFAULT_EXPORT_COMPOSITION_LAYOUT.organizationalLegend.contentScale === 1,
    String(DEFAULT_EXPORT_COMPOSITION_LAYOUT.organizationalLegend.contentScale),
  )
  check(
    'top-right-content-scale',
    topRight.organizationalLegend.contentScale >= 1,
    String(topRight.organizationalLegend.contentScale),
  )
  check(
    'sanitize-preserves-custom-scale',
    sanitizeExportCompositionLayout({
      ...DEFAULT_EXPORT_COMPOSITION_LAYOUT,
      organizationalLegend: {
        ...DEFAULT_EXPORT_COMPOSITION_LAYOUT.organizationalLegend,
        contentScale: 1.8,
      },
    }).organizationalLegend.contentScale === 1.8,
    '1.8',
  )

  const canvasSource = readFileSync(
    join(process.cwd(), 'src/components/map/export/ExportCompositionCanvas.tsx'),
    'utf8',
  )
  check(
    'composition-canvas-has-map-drag',
    canvasSource.includes("kind: 'move', target: 'map'"),
    'map drag',
  )
  check(
    'composition-canvas-has-legend-scale',
    canvasSource.includes("kind: 'resize-scale'"),
    'legend scale handle',
  )
  check(
    'composition-canvas-uses-scaled-tokens',
    canvasSource.includes('scaleLegendStyleTokens'),
    'scaled tokens',
  )
  check(
    'composition-canvas-no-divider',
    !canvasSource.includes("borderLeft: '1px solid #e2e8f0'"),
    'no vertical divider',
  )

  const fullMap = resolveExportMapRect({
    ...canvas,
    composition: DEFAULT_EXPORT_COMPOSITION_LAYOUT,
  })
  const content = computeExportContentRect(canvas.canvasWidth, canvas.canvasHeight)
  const fullMapAreaRatio = (fullMap.width * fullMap.height) / (content.width * content.height)
  check(
    'map-full-default-maximizes-content',
    fullMapAreaRatio >= 0.85,
    `area=${(fullMapAreaRatio * 100).toFixed(1)}% map=${fullMap.width}x${fullMap.height}`,
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-export-composition ===\n')
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
