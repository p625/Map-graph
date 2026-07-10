import { useMemo, useState } from 'react'
import {
  createCustomExportPreset,
  customPresetKey,
  isBuiltinPresetKey,
  loadCustomExportPresets,
  parsePresetKey,
  saveCustomExportPresets,
  type CustomExportPreset,
} from '../../../domain/export/customExportPresets'
import { exportPresets } from '../../../domain/export/exportPresets'
import type { MapExportSettings } from './MapExportPanel'

interface ExportPresetControlsProps {
  selectedPresetKey: string
  settings: MapExportSettings
  onSelectPreset: (key: string, settings: MapExportSettings) => void
  onPresetKeyChange: (key: string) => void
}

function settingsToCustomPreset(settings: MapExportSettings, name: string): CustomExportPreset {
  return createCustomExportPreset({
    name,
    width: settings.presetId === 'custom' ? settings.customWidth : settings.customWidth,
    height: settings.presetId === 'custom' ? settings.customHeight : settings.customHeight,
    mapSizeMode: settings.mapSizeMode,
    mapWidthPercent: settings.mapAreaPercent,
    mapHeightPercent: settings.mapAreaPercent,
    showTitle: Boolean(settings.title.trim()),
    showSubtitle: Boolean(settings.subtitle.trim()),
    showLegend: settings.showLegend,
    showOrganizationLegend: settings.showOrganizationLegend,
    showDatasetInfo: settings.showDatasetInfo,
    exportScope: settings.exportScope,
    quality: settings.quality,
  })
}

function customPresetToSettings(preset: CustomExportPreset, current: MapExportSettings): MapExportSettings {
  return {
    ...current,
    title: preset.showTitle ? current.title : '',
    subtitle: preset.showSubtitle ? current.subtitle : '',
    showLegend: preset.showLegend,
    showOrganizationLegend: preset.showOrganizationLegend,
    showDatasetInfo: preset.showDatasetInfo,
    presetId: 'custom',
    customWidth: preset.width,
    customHeight: preset.height,
    quality: preset.quality,
    exportScope: preset.exportScope,
    mapSizeMode: preset.mapSizeMode,
    mapAreaPercent: preset.mapWidthPercent,
  }
}

function builtinPresetToSettings(key: string, current: MapExportSettings): MapExportSettings {
  const builtin = exportPresets.find((preset) => preset.id === key)
  if (!builtin) return current
  return {
    ...current,
    presetId: builtin.id,
    customWidth: builtin.width,
    customHeight: builtin.height,
  }
}

export function ExportPresetControls({
  selectedPresetKey,
  settings,
  onSelectPreset,
  onPresetKeyChange,
}: ExportPresetControlsProps) {
  const [customPresets, setCustomPresets] = useState(() => loadCustomExportPresets())
  const [newPresetName, setNewPresetName] = useState('')
  const [menuPresetId, setMenuPresetId] = useState<string | null>(null)

  const selectedCustom = useMemo(() => {
    const parsed = parsePresetKey(selectedPresetKey)
    if (parsed.kind !== 'custom') return null
    return customPresets.find((preset) => preset.id === parsed.id) ?? null
  }, [selectedPresetKey, customPresets])

  function persistCustom(next: CustomExportPreset[]) {
    setCustomPresets(next)
    saveCustomExportPresets(next)
  }

  function handleSelect(key: string) {
    onPresetKeyChange(key)
    const parsed = parsePresetKey(key)
    if (parsed.kind === 'custom') {
      const preset = customPresets.find((item) => item.id === parsed.id)
      if (!preset) return
      onSelectPreset(key, customPresetToSettings(preset, settings))
      return
    }
    if (isBuiltinPresetKey(parsed.id)) {
      onSelectPreset(key, builtinPresetToSettings(parsed.id, settings))
    }
  }

  function handleSaveNew() {
    const name = newPresetName.trim() || `Preset ${customPresets.length + 1}`
    const width =
      settings.presetId === 'custom'
        ? settings.customWidth
        : exportPresets.find((preset) => preset.id === settings.presetId)?.width ?? 1920
    const height =
      settings.presetId === 'custom'
        ? settings.customHeight
        : exportPresets.find((preset) => preset.id === settings.presetId)?.height ?? 1080

    const preset = createCustomExportPreset({
      ...settingsToCustomPreset({ ...settings, customWidth: width, customHeight: height }, name),
      name,
      width,
      height,
    })
    const next = [...customPresets, preset]
    persistCustom(next)
    const key = customPresetKey(preset.id)
    onPresetKeyChange(key)
    setNewPresetName('')
  }

  function handleRename(presetId: string) {
    const name = window.prompt('Nový název presetu')
    if (!name?.trim()) return
    const next = customPresets.map((preset) =>
      preset.id === presetId
        ? { ...preset, name: name.trim(), updatedAt: new Date().toISOString() }
        : preset,
    )
    persistCustom(next)
    setMenuPresetId(null)
  }

  function handleDuplicate(presetId: string) {
    const source = customPresets.find((preset) => preset.id === presetId)
    if (!source) return
    const copy = createCustomExportPreset({
      ...source,
      name: `${source.name} (kopie)`,
    })
    persistCustom([...customPresets, copy])
    onPresetKeyChange(customPresetKey(copy.id))
    onSelectPreset(customPresetKey(copy.id), customPresetToSettings(copy, settings))
    setMenuPresetId(null)
  }

  function handleDelete(presetId: string) {
    const next = customPresets.filter((preset) => preset.id !== presetId)
    persistCustom(next)
    if (selectedPresetKey === customPresetKey(presetId)) {
      onPresetKeyChange('presentation-16-9')
      onSelectPreset('presentation-16-9', builtinPresetToSettings('presentation-16-9', settings))
    }
    setMenuPresetId(null)
  }

  return (
    <div className="space-y-2 text-sm">
      <span className="font-medium text-slate-700">Exportní preset</span>
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2"
        value={selectedPresetKey}
        onChange={(event) => handleSelect(event.target.value)}
      >
        <optgroup label="Vestavěné">
          {exportPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({preset.width}×{preset.height})
            </option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="Vlastní">
            {customPresets.map((preset) => (
              <option key={preset.id} value={customPresetKey(preset.id)}>
                {preset.name} ({preset.width}×{preset.height})
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
          placeholder="Název nového presetu"
          value={newPresetName}
          onChange={(event) => setNewPresetName(event.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
          onClick={handleSaveNew}
        >
          Uložit jako nový
        </button>
      </div>

      {selectedCustom && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-700">{selectedCustom.name}</span>
            <button
              type="button"
              className="text-slate-600 underline"
              onClick={() =>
                setMenuPresetId(menuPresetId === selectedCustom.id ? null : selectedCustom.id)
              }
            >
              Akce
            </button>
          </div>
          {menuPresetId === selectedCustom.id && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-white"
                onClick={() => handleRename(selectedCustom.id)}
              >
                Přejmenovat
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-white"
                onClick={() => handleDuplicate(selectedCustom.id)}
              >
                Duplikovat
              </button>
              <button
                type="button"
                className="rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(selectedCustom.id)}
              >
                Smazat
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function resolveExportDimensionsFromPresetKey(
  key: string,
  settings: MapExportSettings,
): { width: number; height: number } {
  const parsed = parsePresetKey(key)
  if (parsed.kind === 'custom') {
    const presets = loadCustomExportPresets()
    const preset = presets.find((item) => item.id === parsed.id)
    if (preset) return { width: preset.width, height: preset.height }
  }
  if (settings.presetId === 'custom') {
    return {
      width: Math.max(400, Math.min(8000, settings.customWidth)),
      height: Math.max(300, Math.min(8000, settings.customHeight)),
    }
  }
  const builtin = exportPresets.find((preset) => preset.id === parsed.id)
  if (builtin) return { width: builtin.width, height: builtin.height }
  return { width: 1920, height: 1080 }
}
