import { useMemo, useRef, useState } from 'react'
import type { ExportPresetId, ExportQuality, ExportPreset } from '../../../domain/export/exportPresets'
import {
  exportPresets,
  getExportPreset,
  resolveExportDimensions,
} from '../../../domain/export/exportPresets'
import { exportMapImage, getExportErrorMessage } from '../../../domain/export/exportMapImage'
import { generateExportFilename } from '../../../domain/export/filenameGenerator'
import type { LegendSpec } from '../../../domain/visualization/types'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { DistrictColorMap } from '../../../domain/visualization/types'
import { useNotifications } from '../../../store/notificationStore'
import { ExportMapLayout } from './ExportMapLayout'
import { MapExportPreview } from './MapExportPreview'

export interface MapExportSettings {
  title: string
  subtitle: string
  showLegend: boolean
  showDatasetInfo: boolean
  presetId: ExportPresetId
  customWidth: number
  customHeight: number
  quality: ExportQuality
}

interface MapExportPanelProps {
  colors: DistrictColorMap
  legend: LegendSpec
  dataset?: Dataset
  column?: DatasetColumn
  pluginName: string
  themeName: string
  strokeColor: string
  defaultTitle: string
  defaultSubtitle: string
}

export function MapExportPanel({
  colors,
  legend,
  dataset,
  column,
  pluginName,
  themeName,
  strokeColor,
  defaultTitle,
  defaultSubtitle,
}: MapExportPanelProps) {
  const { notify } = useNotifications()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState<MapExportSettings>({
    title: defaultTitle,
    subtitle: defaultSubtitle,
    showLegend: true,
    showDatasetInfo: true,
    presetId: 'presentation-16-9',
    customWidth: 1200,
    customHeight: 800,
    quality: 'standard',
  })

  const dimensions = useMemo(
    () => resolveExportDimensions(settings.presetId, settings.customWidth, settings.customHeight),
    [settings.presetId, settings.customWidth, settings.customHeight],
  )

  const filename = useMemo(
    () =>
      generateExportFilename({
        datasetName: dataset?.name,
        columnName: column?.name,
      }),
    [dataset?.name, column?.name],
  )

  async function handleExport() {
    if (!canvasRef.current) {
      setError('Exportní plátno není připraveno.')
      return
    }

    setExporting(true)
    setError(null)

    try {
      await exportMapImage({
        node: canvasRef.current,
        width: dimensions.width,
        height: dimensions.height,
        quality: settings.quality,
        filename,
      })

      notify({
        type: 'success',
        title: 'Mapa exportována',
        message: `Soubor „${filename}" byl stažen. Můžete ho vložit do PowerPointu nebo Wordu.`,
      })
    } catch (exportError) {
      const message = getExportErrorMessage(exportError)
      setError(message)
      notify({
        type: 'error',
        title: 'Export selhal',
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const layoutProps = {
    title: settings.title,
    subtitle: settings.subtitle,
    colors,
    legend,
    width: dimensions.width,
    height: dimensions.height,
    showLegend: settings.showLegend,
    showDatasetInfo: settings.showDatasetInfo,
    dataset,
    column,
    pluginName,
    themeName,
    strokeColor,
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Export mapy</h3>
            <p className="mt-1 text-xs text-slate-500">
              Nastavte vzhled a uložte mapový graf jako PNG.
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Název mapy</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.title}
              onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Podtitulek / poznámka</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.subtitle}
              onChange={(e) => setSettings((s) => ({ ...s, subtitle: e.target.value }))}
              placeholder="Volitelný popisek"
            />
          </label>

          <div className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Velikost výstupu</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.presetId}
              onChange={(e) =>
                setSettings((s) => ({ ...s, presetId: e.target.value as ExportPresetId }))
              }
            >
              {exportPresets.map((preset: ExportPreset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.width}×{preset.height})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">{getExportPreset(settings.presetId).description}</p>
          </div>

          {settings.presetId === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Šířka (px)</span>
                <input
                  type="number"
                  min={400}
                  max={8000}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={settings.customWidth}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, customWidth: Number(e.target.value) || 1200 }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Výška (px)</span>
                <input
                  type="number"
                  min={300}
                  max={8000}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={settings.customHeight}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, customHeight: Number(e.target.value) || 800 }))
                  }
                />
              </label>
            </div>
          )}

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Kvalita exportu</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.quality}
              onChange={(e) =>
                setSettings((s) => ({ ...s, quality: e.target.value as ExportQuality }))
              }
            >
              <option value="standard">Standard (vhodné pro obrazovku)</option>
              <option value="high">High resolution (tisk / projekce)</option>
            </select>
          </label>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showLegend}
                onChange={(e) => setSettings((s) => ({ ...s, showLegend: e.target.checked }))}
              />
              <span>Zobrazit legendu</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showDatasetInfo}
                onChange={(e) => setSettings((s) => ({ ...s, showDatasetInfo: e.target.checked }))}
              />
              <span>Zobrazit info o datasetu</span>
            </label>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Soubor: <span className="font-mono">{filename}</span>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={exporting}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void handleExport()}
          >
            {exporting ? 'Exportuji…' : 'Exportovat PNG'}
          </button>

          <p className="text-xs text-slate-500">
            Po exportu vložte obrázek do PowerPointu nebo Wordu přes Vložit → Obrázky.
          </p>
        </div>

        <MapExportPreview {...layoutProps} />
      </div>

      {/* Skrytý canvas pro export v plném rozlišení — bez CSS scale */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: -20000,
          top: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <ExportMapLayout ref={canvasRef} {...layoutProps} />
      </div>
    </div>
  )
}
