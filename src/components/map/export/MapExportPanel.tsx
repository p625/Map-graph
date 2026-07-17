import { useMemo, useRef, useState } from 'react'
import type { ExportPresetId, ExportQuality } from '../../../domain/export/exportPresets'
import { exportMapImage, getExportErrorMessage } from '../../../domain/export/exportMapImage'
import { generateExportFilename } from '../../../domain/export/filenameGenerator'
import type { LabelContentMode } from '../../../domain/labels/labelEngine'
import type { MapLabelFontSizes, MapLabelVisibility } from '../../../domain/labels/labelSettings'
import type { BoundaryVisibility } from '../../../domain/territory/types'
import type { ExportMapSizing, MapSizeMode } from '../../../domain/export/exportMapLayout'
import { BALANCED_EXPORT_MAP_SIZING, DEFAULT_EXPORT_MAP_SIZING } from '../../../domain/export/exportMapLayout'
import type { ExportMapScope } from '../../../domain/region/types'
import type { LegendSpec, VisualizationContext } from '../../../domain/visualization/types'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { DistrictColorMap } from '../../../domain/visualization/types'
import { applyRegionFocusColors, filterLegendForRegion } from '../../../domain/region/regionFocus'
import type { RegionRenderMode } from '../../../domain/region/regionFocus'
import { isRegionFocused } from '../../../domain/region/regionScope'
import { visualizationRegistry } from '../../../domain/visualization/VisualizationRegistry'
import { useActiveVisualization } from '../../../hooks/useVisualization'
import { useRegionScope } from '../../../hooks/useRegionScope'
import { resolveTemplateColorThemeId } from '../../../domain/color-themes/colorThemeRegistry'
import { useCustomColorThemes } from '../../../store/customColorThemesStore'
import { useMapActions, useMapState } from '../../../store/mapStore'
import { useNotifications } from '../../../store/notificationStore'
import { TemplateManager } from '../TemplateManager'
import { ExportMapLayout } from './ExportMapLayout'
import { ExportPresetControls, resolveExportDimensionsFromPresetKey } from './ExportPresetControls'
import { MapExportPreview } from './MapExportPreview'

export interface MapExportSettings {
  title: string
  subtitle: string
  showLegend: boolean
  showOrganizationLegend: boolean
  showDatasetInfo: boolean
  showLabels: boolean
  labelVisibility: MapLabelVisibility
  labelFontSizes: MapLabelFontSizes
  labelContentMode: LabelContentMode
  boundaryVisibility: BoundaryVisibility
  presetId: ExportPresetId
  customWidth: number
  customHeight: number
  quality: ExportQuality
  exportScope: ExportMapScope
  mapSizeMode: MapSizeMode
  mapAreaPercent: number
}

export interface MapTemplateApplyPayload {
  settings: MapExportSettings
  pluginId?: string
  themeId?: string
  colorThemeId?: string
  columnKey?: string | null
  regionFocusEnabled?: boolean
  focusedRegionId?: string | null
}

interface MapExportPanelProps {
  colors: DistrictColorMap
  legend: LegendSpec
  context?: VisualizationContext
  dataset?: Dataset
  column?: DatasetColumn
  pluginName: string
  themeName: string
  strokeColor: string
  defaultTitle: string
  defaultSubtitle: string
}

export function MapExportPanel({
  colors: _interactiveColors,
  legend: _interactiveLegend,
  context,
  dataset,
  column,
  pluginName,
  themeName,
  strokeColor,
  defaultTitle,
  defaultSubtitle,
}: MapExportPanelProps) {
  const { plugin } = useActiveVisualization()
  const regionScope = useRegionScope()
  const { notify } = useNotifications()
  const {
    showLabels: mapShowLabels,
    labelVisibility: mapLabelVisibility,
    labelFontSizes: mapLabelFontSizes,
    labelContentMode: mapLabelContentMode,
    boundaryVisibility: mapBoundaries,
    pluginId: mapPluginId,
    themeId: mapThemeId,
    colorThemeId: mapColorThemeId,
    columnKey: mapColumnKey,
    organizationLegend,
    activeExportPresetKey,
  } = useMapState()
  const {
    setPlugin,
    setTheme,
    setColorTheme,
    setColumn,
    setBoundaryVisibility,
    setShowLabels,
    updateLabelVisibility,
    updateLabelFontSizes,
    setLabelContentMode,
    setFocusedRegion,
    clearFocusedRegion,
    setActiveExportPresetKey,
  } = useMapActions()
  const { focusedRegionId } = useMapState()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [settings, setSettings] = useState<MapExportSettings>({
    title: defaultTitle,
    subtitle: defaultSubtitle,
    showLegend: true,
    showOrganizationLegend: organizationLegend.enabled,
    showDatasetInfo: true,
    showLabels: mapShowLabels,
    labelVisibility: mapLabelVisibility,
    labelFontSizes: mapLabelFontSizes,
    labelContentMode: mapLabelContentMode,
    boundaryVisibility: mapBoundaries,
    presetId: 'presentation-16-9',
    customWidth: 1200,
    customHeight: 800,
    quality: 'standard',
    exportScope: isRegionFocused(regionScope) ? 'focused-region' : 'country',
    mapSizeMode: 'maximum',
    mapAreaPercent: 85,
  })

  const dimensions = useMemo(
    () => resolveExportDimensionsFromPresetKey(activeExportPresetKey, settings),
    [activeExportPresetKey, settings],
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

  const exportRegionMode: RegionRenderMode =
    settings.exportScope === 'focused-region' && isRegionFocused(regionScope)
      ? 'export-focused'
      : 'export-country'

  const exportColors = useMemo(() => {
    if (!context) return _interactiveColors
    const activePlugin = visualizationRegistry.getById(mapPluginId) ?? plugin
    const base = activePlugin.resolveColors(context)
    return applyRegionFocusColors(base, context.regionScope!, exportRegionMode)
  }, [context, mapPluginId, plugin, exportRegionMode, _interactiveColors])

  const exportLegend = useMemo(() => {
    const activePlugin = visualizationRegistry.getById(mapPluginId) ?? plugin
    if (!context?.regionScope) return _interactiveLegend
    const base = activePlugin.buildLegend(context)
    return filterLegendForRegion(base, activePlugin.id, context.regionScope, context)
  }, [context, mapPluginId, plugin, _interactiveLegend])

  const { customThemes } = useCustomColorThemes()

  function handleApplyTemplate(payload: MapTemplateApplyPayload) {
    setSettings(payload.settings)
    if (payload.pluginId) setPlugin(payload.pluginId)
    if (payload.themeId) setTheme(payload.themeId)
    if (payload.colorThemeId) {
      const resolved = resolveTemplateColorThemeId(payload.colorThemeId, customThemes)
      setColorTheme(resolved.colorThemeId)
      if (resolved.usedFallback) {
        notify({
          type: 'info',
          title: 'Barevné téma',
          message: 'Původní barevné téma již není dostupné. Bylo použito výchozí téma.',
        })
      }
    }
    if (payload.columnKey !== undefined) setColumn(payload.columnKey)
    setBoundaryVisibility(payload.settings.boundaryVisibility)
    setShowLabels(payload.settings.showLabels)
    updateLabelVisibility(payload.settings.labelVisibility)
    updateLabelFontSizes(payload.settings.labelFontSizes)
    setLabelContentMode(payload.settings.labelContentMode)

    if (payload.regionFocusEnabled === false) {
      clearFocusedRegion()
    } else if (payload.focusedRegionId) {
      const exists = context?.regionalOffices.some((region) => region.id === payload.focusedRegionId)
      if (exists) {
        setFocusedRegion(payload.focusedRegionId)
      } else {
        clearFocusedRegion()
        notify({
          type: 'warning',
          title: 'Region v šabloně nenalezen',
          message: 'Šablona odkazovala na neplatný region. Focus byl resetován na celou ČR.',
        })
      }
    }
  }

  const exportTitle =
    settings.title ||
    (exportRegionMode === 'export-focused' && regionScope.regionName
      ? `${defaultTitle} — ${regionScope.regionName}`
      : defaultTitle)

  const mapSizing: ExportMapSizing =
    settings.mapSizeMode === 'balanced'
      ? BALANCED_EXPORT_MAP_SIZING
      : settings.mapSizeMode === 'custom'
        ? { mode: 'custom', mapAreaPercent: settings.mapAreaPercent }
        : DEFAULT_EXPORT_MAP_SIZING

  const layoutProps = {
    title: exportTitle,
    subtitle: settings.subtitle,
    colors: exportColors,
    legend: exportLegend,
    width: dimensions.width,
    height: dimensions.height,
    showLegend: settings.showLegend,
    showOrganizationLegend: settings.showOrganizationLegend,
    showDatasetInfo: settings.showDatasetInfo,
    showLabels: settings.showLabels,
    labelVisibility: settings.labelVisibility,
    labelFontSizes: settings.labelFontSizes,
    labelContentMode: settings.labelContentMode,
    boundaryVisibility: settings.boundaryVisibility,
    context,
    dataset,
    column,
    pluginName,
    themeName,
    strokeColor,
    regionScope,
    regionRenderMode: exportRegionMode,
    mapSizing,
    organizationLegendSettings: organizationLegend,
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

          <ExportPresetControls
            selectedPresetKey={activeExportPresetKey}
            settings={settings}
            onPresetKeyChange={setActiveExportPresetKey}
            onSelectPreset={(key, nextSettings) => {
              setActiveExportPresetKey(key)
              setSettings(nextSettings)
            }}
          />

          <div className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Velikost mapy v exportu</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.mapSizeMode}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  mapSizeMode: e.target.value as MapSizeMode,
                }))
              }
            >
              <option value="maximum">Maximum — mapa téměř celá plocha</option>
              <option value="balanced">Vyvážené — mapa + legenda</option>
              <option value="custom">Vlastní podíl mapy</option>
            </select>
            {settings.mapSizeMode === 'custom' && (
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">
                  Podíl mapy: {settings.mapAreaPercent} %
                </span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={settings.mapAreaPercent}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      mapAreaPercent: Number(e.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
            )}
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  mapSizeMode: 'maximum',
                  mapAreaPercent: 85,
                  showLegend: false,
                  showDatasetInfo: false,
                  title: '',
                  subtitle: '',
                }))
              }
            >
              Obnovit doporučené rozložení (map-only)
            </button>
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
            <span className="font-medium text-slate-700">Rozsah exportu</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={settings.exportScope}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  exportScope: e.target.value as ExportMapScope,
                }))
              }
            >
              <option value="country">Celá ČR</option>
              <option value="focused-region" disabled={!isRegionFocused(regionScope)}>
                Pouze vybraný region
              </option>
            </select>
            {!isRegionFocused(regionScope) && (
              <p className="text-xs text-slate-500">
                Pro export regionu nejprve vyberte region v regionálním focusu.
              </p>
            )}
            {isRegionFocused(regionScope) && focusedRegionId && (
              <p className="text-xs text-slate-500">
                Aktivní region: {regionScope.regionName}
              </p>
            )}
          </label>

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
                checked={settings.showOrganizationLegend}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showOrganizationLegend: e.target.checked }))
                }
              />
              <span>Zobrazit organizační legendu</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showDatasetInfo}
                onChange={(e) => setSettings((s) => ({ ...s, showDatasetInfo: e.target.checked }))}
              />
              <span>Zobrazit info o datasetu</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showLabels}
                onChange={(e) => setSettings((s) => ({ ...s, showLabels: e.target.checked }))}
              />
              <span>Zobrazit popisky na mapě</span>
            </label>
          </div>

          <div className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Popisky</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.labelVisibility.showWorkplaceLabels}
                disabled={!settings.showLabels}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    labelVisibility: { ...s.labelVisibility, showWorkplaceLabels: e.target.checked },
                  }))
                }
              />
              <span>Pracoviště</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.labelVisibility.showRegionLabels}
                disabled={!settings.showLabels}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    labelVisibility: { ...s.labelVisibility, showRegionLabels: e.target.checked },
                  }))
                }
              />
              <span>Regiony</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.labelVisibility.showDistrictLabels}
                disabled={!settings.showLabels}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    labelVisibility: { ...s.labelVisibility, showDistrictLabels: e.target.checked },
                  }))
                }
              />
              <span>Okresy</span>
            </label>
            {column && (
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={settings.labelContentMode}
                disabled={!settings.showLabels || !settings.labelVisibility.showWorkplaceLabels}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    labelContentMode: e.target.value as LabelContentMode,
                  }))
                }
              >
                <option value="name">Název</option>
                <option value="value">Hodnota</option>
                <option value="name-value">Název + hodnota</option>
              </select>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Hranice ve výstupu</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.boundaryVisibility.district}
                onChange={() =>
                  setSettings((s) => ({
                    ...s,
                    boundaryVisibility: {
                      ...s.boundaryVisibility,
                      district: !s.boundaryVisibility.district,
                    },
                  }))
                }
              />
              <span>Okresy</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.boundaryVisibility.workplace}
                onChange={() =>
                  setSettings((s) => ({
                    ...s,
                    boundaryVisibility: {
                      ...s.boundaryVisibility,
                      workplace: !s.boundaryVisibility.workplace,
                    },
                  }))
                }
              />
              <span>Pracoviště</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.boundaryVisibility.region}
                onChange={() =>
                  setSettings((s) => ({
                    ...s,
                    boundaryVisibility: {
                      ...s.boundaryVisibility,
                      region: !s.boundaryVisibility.region,
                    },
                  }))
                }
              />
              <span>Regiony</span>
            </label>
          </div>

          <TemplateManager
            settings={settings}
            pluginId={mapPluginId}
            themeId={mapThemeId}
            colorThemeId={mapColorThemeId}
            columnKey={mapColumnKey}
            defaultTitle={defaultTitle}
            defaultSubtitle={defaultSubtitle}
            onApply={handleApplyTemplate}
          />

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
