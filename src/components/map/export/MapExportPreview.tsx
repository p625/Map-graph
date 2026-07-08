import { useMemo } from 'react'
import type { ExportMapLayoutProps } from './ExportMapLayout'
import { ExportMapLayout } from './ExportMapLayout'

interface MapExportPreviewProps extends Omit<ExportMapLayoutProps, 'createdAt'> {
  previewMaxWidth?: number
}

export function MapExportPreview({
  previewMaxWidth = 900,
  width,
  height,
  ...layoutProps
}: MapExportPreviewProps) {
  const scale = useMemo(() => {
    const maxW = previewMaxWidth
    const maxH = 560
    return Math.min(maxW / width, maxH / height, 1)
  }, [width, height, previewMaxWidth])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Náhled výstupu</h3>
        <span className="text-xs text-slate-500">
          {width} × {height} px
          {scale < 1 ? ` · náhled ${Math.round(scale * 100)} %` : ''}
        </span>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
        <div
          style={{
            width: width * scale,
            height: height * scale,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width,
              height,
            }}
          >
            <ExportMapLayout width={width} height={height} {...layoutProps} />
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Náhled odpovídá výslednému PNG. Při exportu se použije plné rozlišení podle zvoleného presetu.
      </p>
    </div>
  )
}
