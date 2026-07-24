/**
 * Validace mapového viewportu — wheel izolace a responzivní výška (Phase 5F).
 */
import {
  applyWheelZoomToEditorView,
  MAP_WHEEL_LISTENER_OPTIONS,
} from '../src/domain/map/mapWheelZoom.ts'
import {
  computeResponsiveDisplayHeights,
  MAP_EDITOR_MAX_VIEWPORT_HEIGHT,
  MAP_EDITOR_MIN_VIEWPORT_HEIGHT,
  MAP_EDITOR_VIEWPORT_HEIGHT_CSS,
  MAP_EDITOR_VIEWPORT_OFFSET_PX,
} from '../src/domain/map/mapEditorLayout.ts'
import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../src/domain/map/mapViewport.ts'
import {
  DEFAULT_MAP_EDITOR_VIEW,
  parseViewBox,
  visibleToEditorState,
  zoomViewBoxAtPoint,
} from '../src/domain/map/mapEditorViewport.ts'

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
  check(
    'wheel-listener-non-passive',
    MAP_WHEEL_LISTENER_OPTIONS.passive === false,
    String(MAP_WHEEL_LISTENER_OPTIONS.passive),
  )

  check(
    'viewport-height-css-clamp',
    MAP_EDITOR_VIEWPORT_HEIGHT_CSS.includes('clamp(') &&
      MAP_EDITOR_VIEWPORT_HEIGHT_CSS.includes(`${MAP_EDITOR_MIN_VIEWPORT_HEIGHT}px`) &&
      MAP_EDITOR_VIEWPORT_HEIGHT_CSS.includes(`${MAP_EDITOR_MAX_VIEWPORT_HEIGHT}px`),
    MAP_EDITOR_VIEWPORT_HEIGHT_CSS,
  )

  const responsiveHeights = computeResponsiveDisplayHeights([768, 900, 1080, 1440])
  check(
    'responsive-height-768',
    responsiveHeights[0] === MAP_EDITOR_MIN_VIEWPORT_HEIGHT,
    String(responsiveHeights[0]),
  )
  check(
    'responsive-height-900',
    responsiveHeights[1]! >= MAP_EDITOR_MIN_VIEWPORT_HEIGHT,
    String(responsiveHeights[1]),
  )
  check(
    'responsive-height-1080',
    responsiveHeights[2]! > responsiveHeights[1]!,
    `${responsiveHeights[1]} -> ${responsiveHeights[2]}`,
  )
  check(
    'responsive-height-1440-capped',
    responsiveHeights[3] === MAP_EDITOR_MAX_VIEWPORT_HEIGHT,
    String(responsiveHeights[3]),
  )

  check(
    'viewport-offset-defined',
    MAP_EDITOR_VIEWPORT_OFFSET_PX >= 150,
    String(MAP_EDITOR_VIEWPORT_OFFSET_PX),
  )

  const baseViewBox = `0 0 ${MAP_LOGICAL_WIDTH} ${MAP_LOGICAL_HEIGHT}`
  const base = parseViewBox(baseViewBox, MAP_LOGICAL_WIDTH, MAP_LOGICAL_HEIGHT)
  const editorView = DEFAULT_MAP_EDITOR_VIEW
  const visible = parseViewBox(baseViewBox, MAP_LOGICAL_WIDTH, MAP_LOGICAL_HEIGHT)
  const zoomed = zoomViewBoxAtPoint(visible, base.width / 2, base.height / 2, 1.2)
  visibleToEditorState(base, zoomed)

  const wheelEvent = {
    deltaY: -100,
    clientX: 400,
    clientY: 300,
  }
  const rect = {
    left: 0,
    top: 0,
    width: 800,
    height: 600,
  }

  let nextZoom = editorView.zoom
  const handled = applyWheelZoomToEditorView(wheelEvent, rect, {
    width: MAP_LOGICAL_WIDTH,
    height: MAP_LOGICAL_HEIGHT,
    baseViewBox,
    displayViewBox: baseViewBox,
    editorView,
    onEditorViewChange: (view) => {
      nextZoom = view.zoom
    },
  })

  check('wheel-zoom-handled', handled, String(handled))
  check('wheel-zoom-updates-view', nextZoom > editorView.zoom, String(nextZoom))

  check(
    'export-logical-size-unchanged',
    MAP_LOGICAL_WIDTH === 760 && MAP_LOGICAL_HEIGHT === 460,
    `${MAP_LOGICAL_WIDTH}x${MAP_LOGICAL_HEIGHT}`,
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-map-viewport ===\n')
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
