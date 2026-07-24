import {
  clientPointToSvg,
  EDITOR_ZOOM_STEP,
  parseViewBox,
  visibleToEditorState,
  zoomViewBoxAtPoint,
  type ClientRectLike,
  type MapEditorViewState,
} from './mapEditorViewport'

export const MAP_WHEEL_LISTENER_OPTIONS = { passive: false } as const

export interface MapWheelInput {
  clientX: number
  clientY: number
  deltaY: number
}

export function applyWheelZoomToEditorView(
  event: MapWheelInput,
  rect: ClientRectLike,
  options: {
    width: number
    height: number
    baseViewBox: string
    displayViewBox: string
    editorView: MapEditorViewState | undefined
    onEditorViewChange: ((view: MapEditorViewState) => void) | undefined
  },
): boolean {
  const { width, height, baseViewBox, displayViewBox, editorView, onEditorViewChange } = options
  if (!editorView || !onEditorViewChange) return false

  const visible = parseViewBox(displayViewBox, width, height)
  const svgPoint = clientPointToSvg(event.clientX, event.clientY, rect, visible)
  const factor = event.deltaY < 0 ? EDITOR_ZOOM_STEP : 1 / EDITOR_ZOOM_STEP
  const nextVisible = zoomViewBoxAtPoint(visible, svgPoint.x, svgPoint.y, factor)
  const base = parseViewBox(baseViewBox, width, height)
  onEditorViewChange(visibleToEditorState(base, nextVisible))
  return true
}
