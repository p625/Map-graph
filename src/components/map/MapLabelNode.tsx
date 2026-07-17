import type { MapLabel } from '../../domain/labels/labelEngine'
import {
  buildRenderedMapLabel,
  estimateRenderedLabelBox,
} from '../../domain/labels/labelRenderModel'

interface MapLabelNodeProps {
  label: MapLabel
  canEdit: boolean
  onDrag?: (entityId: string, dx: number, dy: number) => void
  onDragEnd?: (entityId: string) => void
  onTextEdit?: (entityId: string, nameText: string) => void
  onPointerDownDrag: (
    event: React.PointerEvent<SVGGElement>,
    entityId: string,
    onDrag?: (entityId: string, dx: number, dy: number) => void,
    onDragEnd?: (entityId: string) => void,
  ) => void
}

export function MapLabelNode({
  label,
  canEdit,
  onDrag,
  onDragEnd,
  onTextEdit,
  onPointerDownDrag,
}: MapLabelNodeProps) {
  const rendered = buildRenderedMapLabel(label)
  const style = rendered.style
  const fontSizePx = rendered.fontSizePx
  const lineHeight = fontSizePx * 1.1
  const valueGap = fontSizePx * 1.25
  const showValue = Boolean(
    rendered.valueText &&
      (rendered.contentMode === 'name-value' ||
        rendered.contentMode === 'supervision-name-year'),
  )
  const nameLines =
    rendered.contentMode === 'value' && rendered.valueText
      ? []
      : rendered.nameLines.length > 0
        ? rendered.nameLines
        : rendered.valueText
          ? []
          : [label.text]
  const box = estimateRenderedLabelBox(rendered)

  const textProps = {
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
    fontSize: fontSizePx,
    fill: style.textColor,
    stroke: style.haloEnabled ? style.haloColor : undefined,
    strokeWidth: style.haloEnabled ? style.haloWidth : 0,
    paintOrder: style.haloEnabled ? ('stroke' as const) : undefined,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
      textTransform: style.textTransform,
      pointerEvents: 'none' as const,
    },
  }

  return (
    <g
      transform={`translate(${rendered.finalX} ${rendered.finalY})`}
      data-label-id={rendered.id}
      style={{ cursor: canEdit ? 'move' : undefined }}
      onDoubleClick={
        canEdit
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onTextEdit?.(rendered.entityId, nameLines.join('\n'))
            }
          : undefined
      }
      onPointerDown={
        canEdit
          ? (event) => onPointerDownDrag(event, rendered.entityId, onDrag, onDragEnd)
          : undefined
      }
    >
      {canEdit && (
        <rect
          x={-box.width / 2}
          y={-box.height / 2}
          width={box.width}
          height={box.height}
          fill="transparent"
          pointerEvents="all"
        />
      )}
      <text {...textProps}>
        {rendered.contentMode === 'value' || rendered.contentMode === 'supervision-year' ? (
          rendered.valueText
        ) : (
          <>
            {nameLines.map((line, index) => (
              <tspan key={`name-${index}`} x={0} dy={index === 0 ? 0 : lineHeight}>
                {line}
              </tspan>
            ))}
            {showValue && rendered.valueText && (
              <tspan x={0} dy={nameLines.length === 0 ? 0 : valueGap} className="label-value">
                {rendered.valueText}
              </tspan>
            )}
          </>
        )}
      </text>
    </g>
  )
}
