/**
 * Validace volného přesouvání organizační legendy (Phase 5F extension).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../src/domain/map/mapViewport.ts'
import {
  clampLegendLayoutToBounds,
  computeLegendMovementBounds,
  DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
  LEGEND_EDGE_PADDING_PX,
  legendPositionFromRatios,
  legendRatiosFromPosition,
  resetOrganizationLegendPosition,
  sanitizeOrganizationLegendLayout,
} from '../src/domain/organization/organizationLegendLayout.ts'

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
  const editorViewport = { width: 980, height: 720 }
  const exportViewport = { width: MAP_LOGICAL_WIDTH, height: MAP_LOGICAL_HEIGHT }
  const layout = DEFAULT_ORGANIZATION_LEGEND_LAYOUT

  const leftBounds = {
    viewportWidth: editorViewport.width,
    viewportHeight: editorViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  }
  const leftPos = legendPositionFromRatios({ xRatio: 0, yRatio: 0 }, leftBounds)
  check(
    'full-width-left-edge',
    leftPos.x === LEGEND_EDGE_PADDING_PX,
    `${leftPos.x}px`,
  )

  const rightPos = legendPositionFromRatios({ xRatio: 1, yRatio: 0 }, leftBounds)
  const movement = computeLegendMovementBounds(leftBounds)
  check(
    'full-width-right-edge',
    rightPos.x === movement.maxX,
    `${rightPos.x}px vs max ${movement.maxX}px`,
  )

  const bottomPos = legendPositionFromRatios({ xRatio: 1, yRatio: 1 }, leftBounds)
  check(
    'full-height-bottom-edge',
    bottomPos.y === movement.maxY,
    `${bottomPos.y}px vs max ${movement.maxY}px`,
  )

  const legacy = sanitizeOrganizationLegendLayout({ xPercent: 58, yPercent: 2, width: 280, height: 220 })
  check(
    'legacy-percent-migration',
    typeof legacy.xRatio === 'number' && typeof legacy.yRatio === 'number',
    `xRatio=${legacy.xRatio.toFixed(3)} yRatio=${legacy.yRatio.toFixed(3)}`,
  )

  const clampedWide = clampLegendLayoutToBounds(
    { ...layout, xRatio: 1, yRatio: 0.5 },
    editorViewport.width,
    editorViewport.height,
  )
  const widePos = legendPositionFromRatios(clampedWide, {
    viewportWidth: editorViewport.width,
    viewportHeight: editorViewport.height,
    legendWidth: clampedWide.width,
    legendHeight: clampedWide.height,
  })
  check(
    'viewport-clamping-keeps-legend-visible',
    widePos.x + clampedWide.width + LEGEND_EDGE_PADDING_PX <= editorViewport.width &&
      widePos.y + clampedWide.height + LEGEND_EDGE_PADDING_PX <= editorViewport.height,
    `${widePos.x},${widePos.y} ${clampedWide.width}x${clampedWide.height}`,
  )

  const shrunk = clampLegendLayoutToBounds(
    { ...layout, xRatio: 1, yRatio: 1 },
    360,
    280,
  )
  check(
    'resize-clamps-out-of-bounds',
    shrunk.xRatio <= 1 && shrunk.yRatio <= 1,
    `xRatio=${shrunk.xRatio.toFixed(3)} yRatio=${shrunk.yRatio.toFixed(3)}`,
  )

  const reset = resetOrganizationLegendPosition(layout, editorViewport.width, editorViewport.height)
  check(
    'reset-position-defaults',
    reset.xRatio === DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio &&
      reset.yRatio === DEFAULT_ORGANIZATION_LEGEND_LAYOUT.yRatio,
    `${reset.xRatio}, ${reset.yRatio}`,
  )

  const editorPos = legendPositionFromRatios({ xRatio: 0.5, yRatio: 0.25 }, {
    viewportWidth: editorViewport.width,
    viewportHeight: editorViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  const exportPos = legendPositionFromRatios({ xRatio: 0.5, yRatio: 0.25 }, {
    viewportWidth: exportViewport.width,
    viewportHeight: exportViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  const editorMovement = computeLegendMovementBounds({
    viewportWidth: editorViewport.width,
    viewportHeight: editorViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  const exportMovement = computeLegendMovementBounds({
    viewportWidth: exportViewport.width,
    viewportHeight: exportViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  const editorRatioX =
    editorMovement.availableWidth > 0
      ? (editorPos.x - LEGEND_EDGE_PADDING_PX) / editorMovement.availableWidth
      : 0
  const exportRatioX =
    exportMovement.availableWidth > 0
      ? (exportPos.x - LEGEND_EDGE_PADDING_PX) / exportMovement.availableWidth
      : 0
  check(
    'export-position-parity',
    Math.abs(editorRatioX - exportRatioX) < 0.001,
    `editor=${editorRatioX.toFixed(3)} export=${exportRatioX.toFixed(3)}`,
  )

  const roundTrip = legendRatiosFromPosition(editorPos.x, editorPos.y, {
    viewportWidth: editorViewport.width,
    viewportHeight: editorViewport.height,
    legendWidth: layout.width,
    legendHeight: layout.height,
  })
  check(
    'ratio-round-trip',
    Math.abs(roundTrip.xRatio - 0.5) < 0.001 && Math.abs(roundTrip.yRatio - 0.25) < 0.001,
    `${roundTrip.xRatio.toFixed(3)}, ${roundTrip.yRatio.toFixed(3)}`,
  )

  const overlaySource = readFileSync(
    join(process.cwd(), 'src/components/map/OrganizationLegendOverlay.tsx'),
    'utf8',
  )
  check(
    'overlay-measures-viewport',
    overlaySource.includes('ResizeObserver') && overlaySource.includes('parentElement'),
    'OrganizationLegendOverlay uses viewport ResizeObserver',
  )

  const czechMapSource = readFileSync(join(process.cwd(), 'src/components/map/CzechMap.tsx'), 'utf8')
  check(
    'overlay-not-using-logical-map-width',
    !czechMapSource.includes('containerWidth={width}'),
    'CzechMap no longer passes logical map width to overlay',
  )

  check(
    'ratio-fields-sanitized',
    sanitizeOrganizationLegendLayout({ xRatio: 1.4, yRatio: -0.2 }).xRatio === 1 &&
      sanitizeOrganizationLegendLayout({ xRatio: 1.4, yRatio: -0.2 }).yRatio === 0,
    'clamped to 0..1',
  )

  check(
    'width-height-ratios-present',
    sanitizeOrganizationLegendLayout({ width: 300, height: 240 }).widthRatio > 0 &&
      sanitizeOrganizationLegendLayout({ width: 300, height: 240 }).heightRatio > 0,
    'derived on sanitize',
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-legend-positioning ===\n')
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
