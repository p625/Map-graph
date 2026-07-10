import { useMemo, useState } from 'react'
import type { MapTemplate } from '../../domain/export/mapTemplates'
import {
  applyMapTemplate,
  loadMapTemplates,
  saveMapTemplates,
} from '../../domain/export/mapTemplates'
import type { MapExportSettings, MapTemplateApplyPayload } from './export/MapExportPanel'
import { useMapState } from '../../store/mapStore'

interface TemplateManagerProps {
  settings: MapExportSettings
  pluginId: string
  themeId: string
  columnKey: string | null
  defaultTitle: string
  defaultSubtitle: string
  onApply: (payload: MapTemplateApplyPayload) => void
}

function templateToPayload(
  template: MapTemplate,
  defaults: { title: string; subtitle: string },
): MapTemplateApplyPayload {
  const resolved = applyMapTemplate(template, defaults)
  return {
    settings: {
      title: resolved.title,
      subtitle: resolved.subtitle,
      showLegend: resolved.showLegend,
      showOrganizationLegend: false,
      showDatasetInfo: resolved.showDatasetInfo,
      showLabels: resolved.showLabels,
      labelScope: resolved.labelScope,
      labelContentMode: resolved.labelContentMode,
      boundaryVisibility: resolved.boundaryVisibility,
      presetId: resolved.presetId,
      customWidth: 1200,
      customHeight: 800,
      quality: resolved.quality,
      exportScope: resolved.exportScope ?? 'country',
      mapSizeMode: 'maximum',
      mapAreaPercent: 85,
    },
    pluginId: resolved.pluginId,
    themeId: resolved.themeId,
    columnKey: resolved.columnKey,
    regionFocusEnabled: resolved.regionFocusEnabled,
    focusedRegionId: resolved.focusedRegionId,
  }
}

function settingsToTemplate(
  settings: MapExportSettings,
  name: string,
  visualization: { pluginId: string; themeId: string; columnKey: string | null },
  regionFocus: { enabled: boolean; focusedRegionId: string | null },
  existing?: MapTemplate,
): MapTemplate {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? crypto.randomUUID(),
    name,
    presetId: settings.presetId,
    quality: settings.quality,
    title: settings.title,
    subtitle: settings.subtitle,
    showLegend: settings.showLegend,
    showDatasetInfo: settings.showDatasetInfo,
    showLabels: settings.showLabels,
    labelScope: settings.labelScope,
    labelContentMode: settings.labelContentMode,
    boundaryVisibility: settings.boundaryVisibility,
    pluginId: visualization.pluginId,
    themeId: visualization.themeId,
    columnKey: visualization.columnKey,
    regionFocusEnabled: regionFocus.enabled,
    focusedRegionId: regionFocus.focusedRegionId,
    exportScope: settings.exportScope,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export function TemplateManager({
  settings,
  pluginId,
  themeId,
  columnKey,
  defaultTitle,
  defaultSubtitle,
  onApply,
}: TemplateManagerProps) {
  const { focusedRegionId, regionViewMode } = useMapState()
  const [templates, setTemplates] = useState<MapTemplate[]>(() => loadMapTemplates())
  const [selectedId, setSelectedId] = useState<string>('')
  const [templateName, setTemplateName] = useState('')

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  )

  function persist(next: MapTemplate[]) {
    setTemplates(next)
    saveMapTemplates(next)
  }

  function handleApply() {
    if (!selectedTemplate) return
    onApply(templateToPayload(selectedTemplate, { title: defaultTitle, subtitle: defaultSubtitle }))
  }

  function handleSave() {
    const name = templateName.trim() || `Šablona ${templates.length + 1}`
    const existing = templates.find((template) => template.name === name)
    const nextTemplate = settingsToTemplate(
      settings,
      name,
      { pluginId, themeId, columnKey },
      {
        enabled: regionViewMode === 'focused' && Boolean(focusedRegionId),
        focusedRegionId,
      },
      existing,
    )
    const next = existing
      ? templates.map((template) => (template.id === existing.id ? nextTemplate : template))
      : [nextTemplate, ...templates]
    persist(next)
    setSelectedId(nextTemplate.id)
    setTemplateName('')
  }

  function handleDelete() {
    if (!selectedTemplate) return
    const next = templates.filter((template) => template.id !== selectedTemplate.id)
    persist(next)
    setSelectedId('')
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Template Manager</h3>
        <p className="mt-1 text-xs text-slate-500">
          Uložte a znovu použijte vizualizaci, export, hranice a popisky.
        </p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Uložené šablony</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Vyberte šablonu</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!selectedTemplate}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          onClick={handleApply}
        >
          Použít
        </button>
        <button
          type="button"
          disabled={!selectedTemplate}
          className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
          onClick={handleDelete}
        >
          Smazat
        </button>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Název nové / aktualizované šablony</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={templateName}
          placeholder="Např. Tisk A4 s regiony"
          onChange={(event) => setTemplateName(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
        onClick={handleSave}
      >
        Uložit aktuální nastavení jako šablonu
      </button>
    </div>
  )
}
