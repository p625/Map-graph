import { visualizationThemes } from '../../domain/visualization/themes'
import { useMapActions, useMapState } from '../../store/mapStore'

export function ThemeSelector() {
  const { themeId } = useMapState()
  const { setTheme } = useMapActions()

  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700">Barevné téma</span>
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2"
        value={themeId}
        onChange={(event) => setTheme(event.target.value)}
      >
        {visualizationThemes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
    </label>
  )
}
