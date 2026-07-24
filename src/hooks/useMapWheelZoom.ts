import { useEffect, useRef, type RefObject } from 'react'
import {
  applyWheelZoomToEditorView,
  MAP_WHEEL_LISTENER_OPTIONS,
} from '../domain/map/mapWheelZoom'
import type { MapEditorViewState } from '../domain/map/mapEditorViewport'

export { applyWheelZoomToEditorView, MAP_WHEEL_LISTENER_OPTIONS } from '../domain/map/mapWheelZoom'

interface UseMapWheelZoomOptions {
  enabled: boolean
  width: number
  height: number
  baseViewBox: string
  displayViewBox: string
  editorView: MapEditorViewState | undefined
  onEditorViewChange: ((view: MapEditorViewState) => void) | undefined
}

export function useMapWheelZoom(
  targetRef: RefObject<HTMLElement | null>,
  options: UseMapWheelZoomOptions,
) {
  const { enabled, width, height, baseViewBox, displayViewBox, editorView, onEditorViewChange } =
    options

  const editorViewRef = useRef(editorView)
  const onChangeRef = useRef(onEditorViewChange)
  const displayViewBoxRef = useRef(displayViewBox)

  editorViewRef.current = editorView
  onChangeRef.current = onEditorViewChange
  displayViewBoxRef.current = displayViewBox

  useEffect(() => {
    const element = targetRef.current
    if (!element || !enabled) return

    function handleWheel(event: WheelEvent) {
      const target = targetRef.current
      if (!target) return
      const rect = target.getBoundingClientRect()
      const handled = applyWheelZoomToEditorView(event, rect, {
        width,
        height,
        baseViewBox,
        displayViewBox: displayViewBoxRef.current,
        editorView: editorViewRef.current,
        onEditorViewChange: onChangeRef.current,
      })
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    element.addEventListener('wheel', handleWheel, MAP_WHEEL_LISTENER_OPTIONS)
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [targetRef, enabled, width, height, baseViewBox])
}
