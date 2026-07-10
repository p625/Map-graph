import type { LabelContentMode, LabelScope, LabelSizePreset } from '../../domain/labels/labelEngine'
import {
  LABEL_FONT_SIZE_MAX,
  LABEL_FONT_SIZE_MIN,
  PRESET_FONT_SIZE_PX,
} from '../../domain/labels/labelEngine'
import { useMapActions, useMapState } from '../../store/mapStore'

const labelScopeOptions: { value: LabelScope; label: string }[] = [
  { value: 'none', label: 'Bez popisků' },
  { value: 'workplace', label: 'Pracoviště' },
  { value: 'region', label: 'Regiony' },
  { value: 'district', label: 'Okresy' },
]

const labelContentOptions: { value: LabelContentMode; label: string }[] = [
  { value: 'name', label: 'Název' },
  { value: 'value', label: 'Hodnota' },
  { value: 'name-value', label: 'Název + hodnota' },
]

const labelSizeOptions: { value: LabelSizePreset; label: string }[] = [
  { value: 'small', label: 'Malá (7 px)' },
  { value: 'medium', label: 'Střední (9 px)' },
  { value: 'large', label: 'Velká (12 px)' },
]

export function MapBoundaryControls({ hasDataColumn = false }: { hasDataColumn?: boolean }) {
  const {
    boundaryVisibility,
    showLabels,
    labelScope,
    labelContentMode,
    labelSizePreset,
    labelFontSizePx,
    labelHaloEnabled,
    labelHideOnCollision,
  } = useMapState()
  const {
    toggleBoundary,
    setShowLabels,
    setLabelScope,
    setLabelContentMode,
    setLabelSizePreset,
    setLabelFontSizePx,
    resetLabelFontSize,
    setLabelHaloEnabled,
    setLabelHideOnCollision,
  } = useMapActions()

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

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(event) => setShowLabels(event.target.checked)}
          />
          <span>Zobrazit popisky</span>
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Rozsah popisků</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={labelScope}
            disabled={!showLabels}
            onChange={(event) => setLabelScope(event.target.value as LabelScope)}
          >
            {labelScopeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Preset velikosti</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={labelSizePreset}
            disabled={!showLabels}
            onChange={(event) => setLabelSizePreset(event.target.value as LabelSizePreset)}
          >
            {labelSizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="font-medium text-slate-700">Velikost písma (px)</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={LABEL_FONT_SIZE_MIN}
              max={LABEL_FONT_SIZE_MAX}
              step={1}
              value={labelFontSizePx}
              disabled={!showLabels}
              onChange={(event) => setLabelFontSizePx(Number(event.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={LABEL_FONT_SIZE_MIN}
              max={LABEL_FONT_SIZE_MAX}
              step={1}
              value={labelFontSizePx}
              disabled={!showLabels}
              onChange={(event) => setLabelFontSizePx(Number(event.target.value))}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center"
            />
          </div>
          <button
            type="button"
            className="text-xs text-slate-600 underline"
            disabled={!showLabels}
            onClick={() => resetLabelFontSize()}
          >
            Obnovit výchozí ({PRESET_FONT_SIZE_PX[labelSizePreset]} px)
          </button>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={labelHaloEnabled}
            disabled={!showLabels}
            onChange={(event) => setLabelHaloEnabled(event.target.checked)}
          />
          <span>Podsvícení popisků (halo)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={labelHideOnCollision}
            disabled={!showLabels}
            onChange={(event) => setLabelHideOnCollision(event.target.checked)}
          />
          <span>Skrýt kolidující okresní popisky</span>
        </label>
        {hasDataColumn && (
          <label className="block space-y-1">
            <span className="font-medium text-slate-700">Obsah popisku</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={labelContentMode}
              disabled={!showLabels || labelScope === 'none' || labelScope === 'region'}
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
      </div>
    </div>
  )
}
