export const MAP_LOGICAL_WIDTH = 760
export const MAP_LOGICAL_HEIGHT = 460
export const MAP_ASPECT_RATIO = MAP_LOGICAL_HEIGHT / MAP_LOGICAL_WIDTH

export interface ViewBoxRect {
  x: number
  y: number
  width: number
  height: number
}

export function parseViewBoxString(viewBox: string): ViewBoxRect {
  const parts = viewBox.trim().split(/\s+/).map(Number)
  return {
    x: parts[0] ?? 0,
    y: parts[1] ?? 0,
    width: parts[2] ?? MAP_LOGICAL_WIDTH,
    height: parts[3] ?? MAP_LOGICAL_HEIGHT,
  }
}

export function applyPanZoom(
  base: ViewBoxRect,
  panX: number,
  panY: number,
  scale: number,
): ViewBoxRect {
  const safeScale = Math.max(1, Math.min(12, scale))
  return {
    x: base.x + panX,
    y: base.y + panY,
    width: base.width / safeScale,
    height: base.height / safeScale,
  }
}

export function viewBoxToString(rect: ViewBoxRect): string {
  return `${rect.x} ${rect.y} ${rect.width} ${rect.height}`
}

export function clientDeltaToSvg(deltaPx: number, viewBoxSize: number, displaySize: number): number {
  if (displaySize <= 0) return deltaPx
  return (deltaPx / displaySize) * viewBoxSize
}

export function zoomAtPoint(
  base: ViewBoxRect,
  panX: number,
  panY: number,
  scale: number,
  zoomFactor: number,
  pointerRatioX: number,
  pointerRatioY: number,
): { panX: number; panY: number; scale: number } {
  const current = applyPanZoom(base, panX, panY, scale)
  const nextScale = Math.max(1, Math.min(12, scale * zoomFactor))
  const next = applyPanZoom(base, panX, panY, nextScale)

  const svgX = current.x + pointerRatioX * current.width
  const svgY = current.y + pointerRatioY * current.height

  return {
    scale: nextScale,
    panX: panX + (svgX - next.x - pointerRatioX * next.width),
    panY: panY + (svgY - next.y - pointerRatioY * next.height),
  }
}
