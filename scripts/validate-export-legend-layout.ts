/**
 * Validace parity organizační legendy mezi editorem a exportem (Phase 5F.1).
 */
import { computeExportLayout } from '../src/domain/export/exportMapLayout.ts'
import {
  DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE,
  extractOrganizationalLegendRatioLayout,
  resolveExportOrganizationLegendLayout,
  resolveLegendLayoutForMapArea,
  resetExportOrganizationLegendLayout,
  sanitizeOrganizationLegendExportState,
} from '../src/domain/organization/exportOrganizationLegendLayout.ts'
import {
  DEFAULT_ORGANIZATION_LEGEND_LAYOUT,
  LEGEND_EDGE_PADDING_PX,
  legendPositionFromRatios,
} from '../src/domain/organization/organizationLegendLayout.ts'
import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../src/domain/map/mapViewport.ts'

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
  const editorMap = { width: 980, height: 720 }
  const exportCanvas = computeExportLayout({
    width: 1920,
    height: 1080,
    showLegend: false,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })
  const exportMap = { width: exportCanvas.mapWidth, height: exportCanvas.mapHeight }
  const style = DEFAULT_ORGANIZATION_LEGEND_LAYOUT

  const editorResolved = resolveLegendLayoutForMapArea(
    extractOrganizationalLegendRatioLayout({
      ...style,
      xRatio: 0,
      yRatio: 0,
    }),
    editorMap,
    style,
  )
  const exportResolved = resolveExportOrganizationLegendLayout(
    editorResolved,
    DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE,
    exportMap,
    style,
  )

  check(
    'editor-top-left-relative-position',
    editorResolved.xRatio === 0 && editorResolved.yRatio === 0,
    `xRatio=${editorResolved.xRatio} yRatio=${editorResolved.yRatio}`,
  )

  const exportPos = legendPositionFromRatios(exportResolved, {
    viewportWidth: exportMap.width,
    viewportHeight: exportMap.height,
    legendWidth: exportResolved.width,
    legendHeight: exportResolved.height,
  })

  check(
    'position-parity-top-left',
    editorResolved.xRatio === exportResolved.xRatio && editorResolved.yRatio === exportResolved.yRatio,
    `editor=${editorResolved.xRatio},${editorResolved.yRatio} export=${exportResolved.xRatio},${exportResolved.yRatio}`,
  )

  check(
    'size-parity-width-ratio',
    Math.abs(editorResolved.widthRatio - exportResolved.widthRatio) < 0.001,
    `${editorResolved.widthRatio.toFixed(4)} vs ${exportResolved.widthRatio.toFixed(4)}`,
  )

  check(
    'size-parity-height-ratio',
    Math.abs(editorResolved.heightRatio - exportResolved.heightRatio) < 0.001,
    `${editorResolved.heightRatio.toFixed(4)} vs ${exportResolved.heightRatio.toFixed(4)}`,
  )

  const wideEditor = resolveLegendLayoutForMapArea(
    extractOrganizationalLegendRatioLayout({ ...style, xRatio: 1, yRatio: 1, widthRatio: 0.35, heightRatio: 0.3 }),
    editorMap,
    style,
  )
  const squareExport = computeExportLayout({
    width: 1200,
    height: 1200,
    showLegend: false,
    showDatasetInfo: false,
    title: '',
    subtitle: '',
    sizing: { mode: 'maximum', mapAreaPercent: 85 },
  })
  const squareResolved = resolveExportOrganizationLegendLayout(
    wideEditor,
    DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE,
    { width: squareExport.mapWidth, height: squareExport.mapHeight },
    style,
  )

  check(
    'responsive-conversion-preserves-ratios',
    squareResolved.xRatio === wideEditor.xRatio &&
      squareResolved.yRatio === wideEditor.yRatio &&
      squareResolved.widthRatio === wideEditor.widthRatio,
    `${squareResolved.widthRatio.toFixed(3)} at ${squareExport.mapWidth}px`,
  )

  const customExport = resolveExportOrganizationLegendLayout(
    editorResolved,
    {
      inheritFromEditor: false,
      layout: { xRatio: 0.25, yRatio: 0.5, widthRatio: 0.2, heightRatio: 0.18 },
    },
    exportMap,
    style,
  )
  check(
    'export-custom-layout-applied',
    Math.abs(customExport.xRatio - 0.25) < 0.001 && Math.abs(customExport.widthRatio - 0.2) < 0.05,
    `x=${customExport.xRatio.toFixed(3)} width=${customExport.width}`,
  )

  check(
    'inherit-from-editor-default',
    sanitizeOrganizationLegendExportState(null).inheritFromEditor,
    String(DEFAULT_ORGANIZATION_LEGEND_EXPORT_STATE.inheritFromEditor),
  )

  const resetLayout = resetExportOrganizationLegendLayout(style, exportMap)
  check(
    'reset-export-default-position',
    resetLayout.xRatio === DEFAULT_ORGANIZATION_LEGEND_LAYOUT.xRatio,
    `${resetLayout.xRatio}`,
  )

  check(
    'export-clamping-keeps-legend-visible',
    exportPos.x + exportResolved.width + LEGEND_EDGE_PADDING_PX <= exportMap.width &&
      exportPos.y + exportResolved.height + LEGEND_EDGE_PADDING_PX <= exportMap.height,
    `${exportPos.x},${exportPos.y}`,
  )

  check(
    'layout-has-width-and-height-ratios',
    typeof DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio === 'number' &&
      typeof DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio === 'number',
    `${DEFAULT_ORGANIZATION_LEGEND_LAYOUT.widthRatio.toFixed(3)} x ${DEFAULT_ORGANIZATION_LEGEND_LAYOUT.heightRatio.toFixed(3)}`,
  )

  check(
    'reference-map-logical-size-unchanged',
    MAP_LOGICAL_WIDTH === 760 && MAP_LOGICAL_HEIGHT === 460,
    `${MAP_LOGICAL_WIDTH}x${MAP_LOGICAL_HEIGHT}`,
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-export-legend-layout ===\n')
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
