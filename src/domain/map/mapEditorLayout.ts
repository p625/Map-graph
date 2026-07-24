import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from './mapViewport'

/** Minimální výška interaktivního mapového viewportu v editoru. */
export const MAP_EDITOR_MIN_VIEWPORT_HEIGHT = 680

/** Maximální výška interaktivního mapového viewportu v editoru. */
export const MAP_EDITOR_MAX_VIEWPORT_HEIGHT = 1100

/** Rezerva pro hlavičku, toolbar a okraje layoutu. */
export const MAP_EDITOR_VIEWPORT_OFFSET_PX = 220

export const MAP_EDITOR_VIEWPORT_HEIGHT_CSS = `clamp(${MAP_EDITOR_MIN_VIEWPORT_HEIGHT}px, calc(100vh - ${MAP_EDITOR_VIEWPORT_OFFSET_PX}px), ${MAP_EDITOR_MAX_VIEWPORT_HEIGHT}px)`

export function computeMapEditorDisplayHeight(viewportHeightPx: number): number {
  const available = viewportHeightPx - MAP_EDITOR_VIEWPORT_OFFSET_PX
  return Math.round(
    Math.max(
      MAP_EDITOR_MIN_VIEWPORT_HEIGHT,
      Math.min(MAP_EDITOR_MAX_VIEWPORT_HEIGHT, available),
    ),
  )
}

export function computeResponsiveDisplayHeights(viewportHeights: number[]): number[] {
  return viewportHeights.map(computeMapEditorDisplayHeight)
}

export function computeDisplayWidthForHeight(displayHeight: number): number {
  return Math.round((displayHeight * MAP_LOGICAL_WIDTH) / MAP_LOGICAL_HEIGHT)
}
