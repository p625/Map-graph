import { useMemo } from 'react'
import { getMinMaxColorsFromStops } from '../../../domain/color-themes/types'
import type { MapColorTheme } from '../../../domain/color-themes/types'

interface GradientPreviewProps {
  stops: MapColorTheme['stops']
  className?: string
}

export function GradientPreview({ stops, className }: GradientPreviewProps) {
  const { minColor, maxColor } = useMemo(() => getMinMaxColorsFromStops(stops), [stops])
  return (
    <div
      className={className ?? 'h-4 w-full rounded border border-slate-200'}
      style={{ background: `linear-gradient(to right, ${minColor}, ${maxColor})` }}
      aria-hidden
    />
  )
}
