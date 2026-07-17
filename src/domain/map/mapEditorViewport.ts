export interface ParsedViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface MapEditorViewState {
  zoom: number
  panX: number
  panY: number
}

export const DEFAULT_MAP_EDITOR_VIEW: MapEditorViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
}

export const MIN_EDITOR_ZOOM = 1
export const MAX_EDITOR_ZOOM = 5
export const EDITOR_ZOOM_STEP = 1.08

export function parseViewBox(viewBox: string, fallbackWidth: number, fallbackHeight: number): ParsedViewBox {
  const parts = viewBox.trim().split(/\s+/).map(Number)
  return {
    x: parts[0] ?? 0,
    y: parts[1] ?? 0,
    width: parts[2] ?? fallbackWidth,
    height: parts[3] ?? fallbackHeight,
  }
}

export function viewBoxToString(box: ParsedViewBox): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`
}

export function sanitizeMapEditorViewState(value: Partial<MapEditorViewState> | null | undefined): MapEditorViewState {
  const zoomRaw = typeof value?.zoom === 'number' ? value.zoom : DEFAULT_MAP_EDITOR_VIEW.zoom
  const zoom = Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, zoomRaw))
  return {
    zoom,
    panX: typeof value?.panX === 'number' && Number.isFinite(value.panX) ? value.panX : 0,
    panY: typeof value?.panY === 'number' && Number.isFinite(value.panY) ? value.panY : 0,
  }
}

export function applyEditorViewToBase(base: ParsedViewBox, editor: MapEditorViewState): ParsedViewBox {
  const width = base.width / editor.zoom
  const height = base.height / editor.zoom
  const centerX = base.x + base.width / 2 + editor.panX
  const centerY = base.y + base.height / 2 + editor.panY
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
}

export function composeEditorViewBox(
  baseViewBox: string,
  editor: MapEditorViewState,
  fallbackWidth: number,
  fallbackHeight: number,
): string {
  const base = parseViewBox(baseViewBox, fallbackWidth, fallbackHeight)
  return viewBoxToString(applyEditorViewToBase(base, editor))
}

export interface ClientRectLike {
  left: number
  top: number
  width: number
  height: number
}

export function clientPointToSvg(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  visible: ParsedViewBox,
): { x: number; y: number } {
  const x = visible.x + ((clientX - rect.left) / rect.width) * visible.width
  const y = visible.y + ((clientY - rect.top) / rect.height) * visible.height
  return { x, y }
}

export function zoomViewBoxAtPoint(
  visible: ParsedViewBox,
  svgX: number,
  svgY: number,
  scale: number,
): ParsedViewBox {
  const safeScale = scale <= 0 ? 1 : scale
  const newWidth = visible.width / safeScale
  const newHeight = visible.height / safeScale
  const ratioX = (svgX - visible.x) / visible.width
  const ratioY = (svgY - visible.y) / visible.height
  return {
    x: svgX - ratioX * newWidth,
    y: svgY - ratioY * newHeight,
    width: newWidth,
    height: newHeight,
  }
}

export function visibleToEditorState(
  base: ParsedViewBox,
  visible: ParsedViewBox,
): MapEditorViewState {
  const zoom = base.width / visible.width
  const panX = visible.x + visible.width / 2 - base.x - base.width / 2
  const panY = visible.y + visible.height / 2 - base.y - base.height / 2
  return sanitizeMapEditorViewState({ zoom, panX, panY })
}

export function panEditorView(
  editor: MapEditorViewState,
  deltaSvgX: number,
  deltaSvgY: number,
): MapEditorViewState {
  return sanitizeMapEditorViewState({
    ...editor,
    panX: editor.panX + deltaSvgX,
    panY: editor.panY + deltaSvgY,
  })
}

export function pixelDeltaToSvgDelta(
  deltaPxX: number,
  deltaPxY: number,
  rect: ClientRectLike,
  visible: ParsedViewBox,
): { dx: number; dy: number } {
  return {
    dx: (deltaPxX / rect.width) * visible.width,
    dy: (deltaPxY / rect.height) * visible.height,
  }
}

export function clampEditorZoom(zoom: number): number {
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, zoom))
}
