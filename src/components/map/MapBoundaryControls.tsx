import { useMemo, useState } from 'react'
import type { LabelContentMode, LabelSizePreset } from '../../domain/labels/labelEngine'
import {
  DISTRICT_FONT_MAX,
  DISTRICT_FONT_MIN,
  PRESET_FONT_SIZE_PX,
  REGION_FONT_MAX,
  REGION_FONT_MIN,
  WORKPLACE_FONT_MAX,
  WORKPLACE_FONT_MIN,
} from '../../domain/labels/labelEngine'
import type { LabelHaloStyle } from '../../domain/labels/labelHaloSettings'
import { HALO_WIDTH_MAX, HALO_WIDTH_MIN } from '../../domain/labels/labelHaloSettings'
import type { OrganizationLegendLabelMode } from '../../domain/organization/organizationLegend'
import { resetOrganizationLegendPosition } from '../../domain/organization/organizationLegendLayout'
import { useMapActions, useMapState } from '../../store/mapStore'
import { useRegionLabelOverrides } from '../../store/regionLabelOverridesStore'
import { useWorkplaceLabelOverrides } from '../../store/workplaceLabelOverridesStore'

const defaultLabelContentOptions: { value: LabelContentMode; label: string }[] = [
  { value: 'name', label: 'Název' },
  { value: 'value', label: 'Hodnota' },
  { value: 'name-value', label: 'Název + hodnota' },
]

const supervisionLabelContentOptions: { value: LabelContentMode; label: string }[] = [
  { value: 'name', label: 'Název' },
  { value: 'supervision-year', label: 'Rok supervize' },
  { value: 'supervision-name-year', label: 'Název + rok' },
]

const labelSizeOptions: { value: LabelSizePreset; label: string }[] = [
  { value: 'small', label: 'Malá (7 px)' },
  { value: 'medium', label: 'Střední (9 px)' },
  { value: 'large', label: 'Velká (12 px)' },
]

function FontSizeControl({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
  onReset,
  resetLabel,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
  onReset?: () => void
  resetLabel?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="flex-1"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center"
        />
      </div>
      {onReset && resetLabel && (
        <button
          type="button"
          className="text-xs text-slate-600 underline"
          disabled={disabled}
          onClick={onReset}
        >
          {resetLabel}
        </button>
      )}
    </label>
  )
}

function HaloControls({
  halo,
  disabled,
  onChange,
}: {
  halo: LabelHaloStyle
  disabled?: boolean
  onChange: (patch: Partial<LabelHaloStyle>) => void
}) {
  return (
    <div className="space-y-2 border-t border-slate-200 pt-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={halo.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
        <span>Halo (podsvícení)</span>
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-slate-600">Barva halo</span>
        <input
          type="color"
          value={halo.color}
          disabled={disabled || !halo.enabled}
          onChange={(event) => onChange({ color: event.target.value })}
          className="h-8 w-full"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-slate-600">Tloušťka halo ({halo.widthPx} px)</span>
        <input
          type="range"
          min={HALO_WIDTH_MIN}
          max={HALO_WIDTH_MAX}
          step={0.5}
          value={halo.widthPx}
          disabled={disabled || !halo.enabled}
          onChange={(event) => onChange({ widthPx: Number(event.target.value) })}
          className="w-full"
        />
      </label>
    </div>
  )
}

export function MapBoundaryControls({ hasDataColumn = false }: { hasDataColumn?: boolean }) {
  const {
    pluginId,
    boundaryVisibility,
    showLabels,
    labelVisibility,
    labelContentMode,
    labelSizePreset,
    labelFontSizes,
    labelHaloSettings,
    labelHideOnCollision,
    labelEditMode,
    regionLabelEditMode,
    organizationLegend,
  } = useMapState()
  const { resetAllOverrides: resetAllWorkplaceOverrides } = useWorkplaceLabelOverrides()
  const { resetAllOverrides: resetAllRegionOverrides } = useRegionLabelOverrides()
  const {
    toggleBoundary,
    setShowLabels,
    setShowWorkplaceLabels,
    setShowRegionLabels,
    setShowDistrictLabels,
    setLabelContentMode,
    setLabelSizePreset,
    setWorkplaceFontSizePx,
    setRegionFontSizePx,
    setDistrictFontSizePx,
    resetLabelFontSize,
    updateWorkplaceHalo,
    updateRegionHalo,
    setLabelHideOnCollision,
    setLabelEditMode,
    setRegionLabelEditMode,
    setOrganizationLegendEnabled,
    setOrganizationLegendLabelMode,
    updateOrganizationLegend,
  } = useMapActions()

  const [openSection, setOpenSection] = useState<'workplace' | 'region' | 'district' | null>(
    'workplace',
  )

  const orgLegendLabelModes: { value: OrganizationLegendLabelMode; label: string }[] = [
    { value: 'leader', label: 'Vedoucí' },
    { value: 'org-unit', label: 'Organizační složka' },
    { value: 'leader-org-unit', label: 'Vedoucí + organizační složka' },
    { value: 'none', label: 'Pouze barva' },
  ]

  function toggleSection(section: 'workplace' | 'region' | 'district') {
    setOpenSection((current) => (current === section ? null : section))
  }

  const labelsDisabled = !showLabels
  const labelContentOptions = useMemo(
    () => (pluginId === 'supervision-plan' ? supervisionLabelContentOptions : defaultLabelContentOptions),
    [pluginId],
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Hranice a popisky</h3>
      <p className="mt-1 text-xs text-slate-500">
        Hranice okresů, pracovišť a regionů lze zobrazit nezávisle.
      </p>

      <div className="mt-4 space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={boundaryVisibility.district}
            onChange={() => toggleBoundary('district')}
          />
          <span>Hranice okresů</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={boundaryVisibility.workplace}
            onChange={() => toggleBoundary('workplace')}
          />
          <span>Hranice pracovišť</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={boundaryVisibility.region}
            onChange={() => toggleBoundary('region')}
          />
          <span>Hranice regionů</span>
        </label>
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(event) => setShowLabels(event.target.checked)}
          />
          <span>Zobrazit popisky</span>
        </label>

        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left font-medium text-slate-800"
            onClick={() => toggleSection('workplace')}
          >
            <span>Pracoviště</span>
            <span className="text-xs text-slate-500">{openSection === 'workplace' ? '▾' : '▸'}</span>
          </button>
          {openSection === 'workplace' && (
            <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={labelVisibility.showWorkplaceLabels}
                  disabled={labelsDisabled}
                  onChange={(event) => setShowWorkplaceLabels(event.target.checked)}
                />
                <span>Zobrazit názvy pracovišť</span>
              </label>
              <FontSizeControl
                label="Velikost písma (px)"
                value={labelFontSizes.workplaceFontSizePx}
                min={WORKPLACE_FONT_MIN}
                max={WORKPLACE_FONT_MAX}
                disabled={labelsDisabled || !labelVisibility.showWorkplaceLabels}
                onChange={setWorkplaceFontSizePx}
                onReset={() => resetLabelFontSize('workplaceFontSizePx')}
                resetLabel={`Obnovit výchozí (${PRESET_FONT_SIZE_PX[labelSizePreset]} px)`}
              />
              <label className="block space-y-1">
                <span className="font-medium text-slate-700">Preset velikosti</span>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={labelSizePreset}
                  disabled={labelsDisabled || !labelVisibility.showWorkplaceLabels}
                  onChange={(event) =>
                    setLabelSizePreset(event.target.value as LabelSizePreset, 'workplaceFontSizePx')
                  }
                >
                  {labelSizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {hasDataColumn && (
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700">Obsah popisku</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={labelContentMode}
                    disabled={labelsDisabled || !labelVisibility.showWorkplaceLabels}
                    onChange={(event) =>
                      setLabelContentMode(event.target.value as LabelContentMode)
                    }
                  >
                    {labelContentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <HaloControls
                halo={labelHaloSettings.workplace}
                disabled={labelsDisabled || !labelVisibility.showWorkplaceLabels}
                onChange={updateWorkplaceHalo}
              />
              <button
                type="button"
                className="text-xs text-slate-600 underline"
                disabled={labelsDisabled}
                onClick={() => setLabelEditMode(!labelEditMode)}
              >
                {labelEditMode ? 'Ukončit úpravu popisků' : 'Upravit popisky'}
              </button>
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left font-medium text-slate-800"
            onClick={() => toggleSection('region')}
          >
            <span>Regiony</span>
            <span className="text-xs text-slate-500">{openSection === 'region' ? '▾' : '▸'}</span>
          </button>
          {openSection === 'region' && (
            <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={labelVisibility.showRegionLabels}
                  disabled={labelsDisabled}
                  onChange={(event) => setShowRegionLabels(event.target.checked)}
                />
                <span>Zobrazit názvy regionů</span>
              </label>
              <FontSizeControl
                label="Velikost písma (px)"
                value={labelFontSizes.regionFontSizePx}
                min={REGION_FONT_MIN}
                max={REGION_FONT_MAX}
                disabled={labelsDisabled || !labelVisibility.showRegionLabels}
                onChange={setRegionFontSizePx}
                onReset={() => resetLabelFontSize('regionFontSizePx')}
                resetLabel="Obnovit výchozí (14 px)"
              />
              <p className="text-xs text-slate-500">
                Regionální popisky jsou výraznější (větší font, vyšší font-weight).
              </p>
              <HaloControls
                halo={labelHaloSettings.region}
                disabled={labelsDisabled || !labelVisibility.showRegionLabels}
                onChange={updateRegionHalo}
              />
              <button
                type="button"
                className="text-xs text-slate-600 underline"
                disabled={labelsDisabled || !labelVisibility.showRegionLabels}
                onClick={() => setRegionLabelEditMode(!regionLabelEditMode)}
              >
                {regionLabelEditMode ? 'Ukončit úpravu popisků regionů' : 'Upravit popisky regionů'}
              </button>
              <button
                type="button"
                className="text-xs text-slate-600 underline"
                disabled={labelsDisabled || !regionLabelEditMode}
                onClick={() => {
                  if (window.confirm('Resetovat všechny ruční popisky regionů?')) {
                    resetAllRegionOverrides()
                  }
                }}
              >
                Reset všech popisků regionů
              </button>
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left font-medium text-slate-800"
            onClick={() => toggleSection('district')}
          >
            <span>Okresy</span>
            <span className="text-xs text-slate-500">{openSection === 'district' ? '▾' : '▸'}</span>
          </button>
          {openSection === 'district' && (
            <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={labelVisibility.showDistrictLabels}
                  disabled={labelsDisabled}
                  onChange={(event) => setShowDistrictLabels(event.target.checked)}
                />
                <span>Zobrazit názvy okresů</span>
              </label>
              <FontSizeControl
                label="Velikost písma (px)"
                value={labelFontSizes.districtFontSizePx}
                min={DISTRICT_FONT_MIN}
                max={DISTRICT_FONT_MAX}
                disabled={labelsDisabled || !labelVisibility.showDistrictLabels}
                onChange={setDistrictFontSizePx}
                onReset={() => resetLabelFontSize('districtFontSizePx')}
                resetLabel="Obnovit výchozí (7 px)"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={labelHideOnCollision}
                  disabled={labelsDisabled || !labelVisibility.showDistrictLabels}
                  onChange={(event) => setLabelHideOnCollision(event.target.checked)}
                />
                <span>Skrýt kolidující okresní popisky</span>
              </label>
            </div>
          )}
        </div>

        {(labelEditMode || regionLabelEditMode) && (
          <p className="text-xs text-amber-700">
            Režim úpravy: táhněte popisek myší. Dvojklik otevře editor — nový řádek klávesou Enter.
            {labelEditMode && regionLabelEditMode
              ? ' (pracoviště i regiony)'
              : labelEditMode
                ? ' (pracoviště)'
                : ' (regiony)'}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <h4 className="font-medium text-slate-700">Organizační legenda v mapě</h4>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={organizationLegend.enabled}
            onChange={(event) => setOrganizationLegendEnabled(event.target.checked)}
          />
          <span>Zobrazit organizační legendu</span>
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Text legendy</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={organizationLegend.labelMode}
            disabled={!organizationLegend.enabled}
            onChange={(event) =>
              setOrganizationLegendLabelMode(event.target.value as OrganizationLegendLabelMode)
            }
          >
            {orgLegendLabelModes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={organizationLegend.showWorkplaceCount}
            disabled={!organizationLegend.enabled}
            onChange={(event) =>
              updateOrganizationLegend({ showWorkplaceCount: event.target.checked })
            }
          />
          <span>Zobrazit počet pracovišť</span>
        </label>
        <FontSizeControl
          label="Velikost písma legendy (px)"
          value={organizationLegend.layout.fontSizePx}
          min={6}
          max={18}
          disabled={!organizationLegend.enabled}
          onChange={(fontSizePx) =>
            updateOrganizationLegend({ layout: { ...organizationLegend.layout, fontSizePx } })
          }
        />
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Pozadí legendy</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={organizationLegend.layout.backgroundMode}
            disabled={!organizationLegend.enabled}
            onChange={(event) =>
              updateOrganizationLegend({
                layout: {
                  ...organizationLegend.layout,
                  backgroundMode: event.target.value as 'transparent' | 'light',
                },
              })
            }
          >
            <option value="transparent">Transparentní</option>
            <option value="light">Lehké bílé</option>
          </select>
        </label>
        <button
          type="button"
          className="text-xs text-slate-600 underline"
          disabled={!organizationLegend.enabled}
          onClick={() =>
            updateOrganizationLegend({
              layout: resetOrganizationLegendPosition(organizationLegend.layout, 760, 460),
            })
          }
        >
          Obnovit pozici legendy
        </button>
        <button
          type="button"
          className="text-xs text-slate-600 underline"
          disabled={!labelEditMode}
          onClick={() => {
            if (window.confirm('Resetovat všechny ruční popisky pracovišť?')) {
              resetAllWorkplaceOverrides()
            }
          }}
        >
          Reset všech popisků pracovišť
        </button>
      </div>
    </div>
  )
}
