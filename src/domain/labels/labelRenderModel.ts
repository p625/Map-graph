import type { MapLabel } from './labelEngine'
import { composeLabelText } from './labelContent'

export interface RenderedMapLabel {
  id: string
  entityId: string
  entityType: 'workplace' | 'region' | 'district'
  anchorX: number
  anchorY: number
  finalX: number
  finalY: number
  nameLines: string[]
  valueText?: string | null
  contentMode: 'name' | 'value' | 'name-value'
  fontSizePx: number
  manualPosition: boolean
  style: MapLabel['style']
  visible: boolean
}

function inferContentMode(label: MapLabel): 'name' | 'value' | 'name-value' {
  if (label.contentMode) return label.contentMode
  if (label.valueText) {
    const name = (label.nameLines ?? []).join('\n')
    if (label.text === label.valueText) return 'value'
    if (label.text === `${name}\n${label.valueText}`) return 'name-value'
  }
  return 'name'
}

export function buildRenderedMapLabel(label: MapLabel): RenderedMapLabel {
  const entityType =
    label.level === 'workplace' ? 'workplace' : label.level === 'region' ? 'region' : 'district'
  const entityId = label.id.replace(/^label-(workplace|region|district)-/, '')
  const contentMode = inferContentMode(label)
  const nameLines =
    label.nameLines ??
    (contentMode === 'value'
      ? []
      : label.text.split('\n').filter((line) => line.length > 0))

  return {
    id: label.id,
    entityId,
    entityType,
    anchorX: label.x,
    anchorY: label.y,
    finalX: label.x,
    finalY: label.y,
    nameLines,
    valueText: label.valueText,
    contentMode,
    fontSizePx: label.style.fontSizePx ?? label.fontSize,
    manualPosition: label.manualPosition ?? false,
    style: label.style,
    visible: label.visible,
  }
}

export function estimateRenderedLabelBox(label: RenderedMapLabel): {
  width: number
  height: number
} {
  const lineCount = label.nameLines.length + (label.valueText && label.contentMode !== 'name' ? 1 : 0)
  const longest = Math.max(
    ...label.nameLines.map((line) => line.length),
    label.valueText?.length ?? 0,
    1,
  )
  const charWidth = label.fontSizePx * 0.52
  return {
    width: Math.min(label.style.maxWidth, longest * charWidth + 8),
    height: label.fontSizePx * (1.15 * lineCount + 0.2),
  }
}

export function renderedLabelDisplayText(label: RenderedMapLabel): string {
  return composeLabelText(label.nameLines, label.valueText, label.contentMode)
}

export function resolveLabelNameLinesForEdit(label: MapLabel): string {
  const rendered = buildRenderedMapLabel(label)
  return rendered.nameLines.join('\n')
}
