import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { defaultThemeId } from '../domain/visualization/themes'
import type { LabelContentMode, LabelScope, LabelSizePreset } from '../domain/labels/labelEngine'
import {
  DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
  type OrganizationLegendLabelMode,
  type OrganizationLegendSettings,
} from '../domain/organization/organizationLegend'
import {
  DEFAULT_LABEL_FONT_SIZE_PX,
  PRESET_FONT_SIZE_PX,
  sanitizeLabelFontSizePx,
} from '../domain/labels/labelEngine'
import { DEFAULT_BOUNDARY_VISIBILITY } from '../domain/export/mapTemplates'
import type { BoundaryVisibility } from '../domain/territory/types'
import type { RegionViewMode } from '../domain/region/types'
import { loadJson, saveJson } from '../utils/storage'

export interface HoveredPolygon {
  workplaceId: string | null
  districtIds: string[]
}

interface MapState {
  pluginId: string
  datasetId: string | null
  columnKey: string | null
  themeId: string
  hoveredPolygon: HoveredPolygon | null
  boundaryVisibility: BoundaryVisibility
  showLabels: boolean
  labelScope: LabelScope
  labelContentMode: LabelContentMode
  labelSizePreset: LabelSizePreset
  labelFontSizePx: number
  labelHaloEnabled: boolean
  labelHideOnCollision: boolean
  organizationLegend: OrganizationLegendSettings
  activeExportPresetKey: string
  selectedPolygon: HoveredPolygon | null
  focusedRegionId: string | null
  regionViewMode: RegionViewMode
}

type MapAction =
  | { type: 'set-plugin'; pluginId: string }
  | { type: 'set-dataset'; datasetId: string | null }
  | { type: 'set-column'; columnKey: string | null }
  | { type: 'set-theme'; themeId: string }
  | { type: 'set-hovered-polygon'; polygon: HoveredPolygon | null }
  | { type: 'set-boundary-visibility'; visibility: BoundaryVisibility }
  | { type: 'toggle-boundary'; level: keyof BoundaryVisibility }
  | { type: 'set-show-labels'; showLabels: boolean }
  | { type: 'set-label-scope'; labelScope: LabelScope }
  | { type: 'set-label-content-mode'; labelContentMode: LabelContentMode }
  | { type: 'set-label-size-preset'; labelSizePreset: LabelSizePreset }
  | { type: 'set-label-font-size-px'; labelFontSizePx: number }
  | { type: 'reset-label-font-size' }
  | { type: 'set-label-halo-enabled'; labelHaloEnabled: boolean }
  | { type: 'set-label-hide-on-collision'; labelHideOnCollision: boolean }
  | { type: 'set-organization-legend'; organizationLegend: OrganizationLegendSettings }
  | { type: 'update-organization-legend'; patch: Partial<OrganizationLegendSettings> }
  | { type: 'set-active-export-preset-key'; activeExportPresetKey: string }
  | { type: 'set-selected-polygon'; polygon: HoveredPolygon | null }
  | { type: 'set-focused-region'; regionId: string }
  | { type: 'clear-focused-region' }
  | { type: 'validate-focused-region'; validRegionIds: string[] }

const MAP_STORAGE_KEY = 'map-graph-map-v3'

const initialState: MapState = {
  pluginId: 'neutral',
  datasetId: null,
  columnKey: null,
  themeId: defaultThemeId,
  hoveredPolygon: null,
  boundaryVisibility: DEFAULT_BOUNDARY_VISIBILITY,
  showLabels: true,
  labelScope: 'workplace',
  labelContentMode: 'name',
  labelSizePreset: 'small',
  labelFontSizePx: PRESET_FONT_SIZE_PX.small,
  labelHaloEnabled: false,
  labelHideOnCollision: false,
  organizationLegend: DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
  activeExportPresetKey: 'presentation-16-9',
  selectedPolygon: null,
  focusedRegionId: null,
  regionViewMode: 'overview',
}

function loadInitialMapState(): MapState {
  const stored = loadJson<Partial<MapState> | null>(MAP_STORAGE_KEY, null)
  if (!stored) return initialState
  return {
    ...initialState,
    ...stored,
    hoveredPolygon: null,
    selectedPolygon: null,
    boundaryVisibility: {
      ...DEFAULT_BOUNDARY_VISIBILITY,
      ...stored.boundaryVisibility,
    },
    labelContentMode: stored.labelContentMode ?? 'name',
    labelSizePreset: stored.labelSizePreset ?? 'small',
    labelFontSizePx: sanitizeLabelFontSizePx(
      stored.labelFontSizePx ?? PRESET_FONT_SIZE_PX[stored.labelSizePreset ?? 'small'],
    ),
    labelHaloEnabled: stored.labelHaloEnabled ?? false,
    labelHideOnCollision: stored.labelHideOnCollision ?? false,
    organizationLegend: {
      ...DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
      ...(stored.organizationLegend ?? {}),
      position: 'top-right',
    },
    activeExportPresetKey: stored.activeExportPresetKey ?? 'presentation-16-9',
    focusedRegionId: stored.focusedRegionId ?? null,
    regionViewMode: stored.regionViewMode ?? 'overview',
  }
}

function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'set-plugin':
      return { ...state, pluginId: action.pluginId, columnKey: null }
    case 'set-dataset':
      return { ...state, datasetId: action.datasetId, columnKey: null }
    case 'set-column':
      return { ...state, columnKey: action.columnKey }
    case 'set-theme':
      return { ...state, themeId: action.themeId }
    case 'set-hovered-polygon':
      return { ...state, hoveredPolygon: action.polygon }
    case 'set-boundary-visibility':
      return { ...state, boundaryVisibility: action.visibility }
    case 'toggle-boundary':
      return {
        ...state,
        boundaryVisibility: {
          ...state.boundaryVisibility,
          [action.level]: !state.boundaryVisibility[action.level],
        },
      }
    case 'set-show-labels':
      return { ...state, showLabels: action.showLabels }
    case 'set-label-scope':
      return { ...state, labelScope: action.labelScope }
    case 'set-label-content-mode':
      return { ...state, labelContentMode: action.labelContentMode }
    case 'set-label-size-preset':
      return {
        ...state,
        labelSizePreset: action.labelSizePreset,
        labelFontSizePx: PRESET_FONT_SIZE_PX[action.labelSizePreset],
      }
    case 'set-label-font-size-px':
      return { ...state, labelFontSizePx: sanitizeLabelFontSizePx(action.labelFontSizePx) }
    case 'reset-label-font-size':
      return {
        ...state,
        labelFontSizePx: PRESET_FONT_SIZE_PX[state.labelSizePreset] ?? DEFAULT_LABEL_FONT_SIZE_PX,
      }
    case 'set-label-halo-enabled':
      return { ...state, labelHaloEnabled: action.labelHaloEnabled }
    case 'set-label-hide-on-collision':
      return { ...state, labelHideOnCollision: action.labelHideOnCollision }
    case 'set-organization-legend':
      return {
        ...state,
        organizationLegend: { ...action.organizationLegend, position: 'top-right' },
      }
    case 'update-organization-legend':
      return {
        ...state,
        organizationLegend: {
          ...state.organizationLegend,
          ...action.patch,
          position: 'top-right',
        },
      }
    case 'set-active-export-preset-key':
      return { ...state, activeExportPresetKey: action.activeExportPresetKey }
    case 'set-selected-polygon':
      return { ...state, selectedPolygon: action.polygon }
    case 'set-focused-region':
      return {
        ...state,
        focusedRegionId: action.regionId,
        regionViewMode: 'focused',
        hoveredPolygon: null,
        selectedPolygon: null,
      }
    case 'clear-focused-region':
      return {
        ...state,
        focusedRegionId: null,
        regionViewMode: 'overview',
        hoveredPolygon: null,
        selectedPolygon: null,
      }
    case 'validate-focused-region': {
      if (!state.focusedRegionId) return state
      if (action.validRegionIds.includes(state.focusedRegionId)) return state
      return {
        ...state,
        focusedRegionId: null,
        regionViewMode: 'overview',
        hoveredPolygon: null,
        selectedPolygon: null,
      }
    }
    default:
      return state
  }
}

const MapStateContext = createContext<MapState | null>(null)
const MapDispatchContext = createContext<Dispatch<MapAction> | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapReducer, undefined, loadInitialMapState)

  useEffect(() => {
    saveJson(MAP_STORAGE_KEY, {
      pluginId: state.pluginId,
      datasetId: state.datasetId,
      columnKey: state.columnKey,
      themeId: state.themeId,
      boundaryVisibility: state.boundaryVisibility,
      showLabels: state.showLabels,
      labelScope: state.labelScope,
      labelContentMode: state.labelContentMode,
      labelSizePreset: state.labelSizePreset,
      labelFontSizePx: state.labelFontSizePx,
      labelHaloEnabled: state.labelHaloEnabled,
      labelHideOnCollision: state.labelHideOnCollision,
      organizationLegend: state.organizationLegend,
      activeExportPresetKey: state.activeExportPresetKey,
      focusedRegionId: state.focusedRegionId,
      regionViewMode: state.regionViewMode,
    })
  }, [
    state.pluginId,
    state.datasetId,
    state.columnKey,
    state.themeId,
    state.boundaryVisibility,
    state.showLabels,
    state.labelScope,
    state.labelContentMode,
    state.labelSizePreset,
    state.labelFontSizePx,
    state.labelHaloEnabled,
    state.labelHideOnCollision,
    state.organizationLegend,
    state.activeExportPresetKey,
    state.focusedRegionId,
    state.regionViewMode,
  ])

  return (
    <MapStateContext.Provider value={state}>
      <MapDispatchContext.Provider value={dispatch}>{children}</MapDispatchContext.Provider>
    </MapStateContext.Provider>
  )
}

export function useMapState(): MapState {
  const context = useContext(MapStateContext)
  if (!context) throw new Error('useMapState must be used within MapProvider')
  return context
}

export function useMapDispatch(): Dispatch<MapAction> {
  const context = useContext(MapDispatchContext)
  if (!context) throw new Error('useMapDispatch must be used within MapProvider')
  return context
}

export function useMapActions() {
  const dispatch = useMapDispatch()
  return useMemo(
    () => ({
      setPlugin: (pluginId: string) => dispatch({ type: 'set-plugin', pluginId }),
      setDataset: (datasetId: string | null) => dispatch({ type: 'set-dataset', datasetId }),
      setColumn: (columnKey: string | null) => dispatch({ type: 'set-column', columnKey }),
      setTheme: (themeId: string) => dispatch({ type: 'set-theme', themeId }),
      setHoveredPolygon: (polygon: HoveredPolygon) =>
        dispatch({ type: 'set-hovered-polygon', polygon }),
      clearHoveredPolygon: () => dispatch({ type: 'set-hovered-polygon', polygon: null }),
      setBoundaryVisibility: (visibility: BoundaryVisibility) =>
        dispatch({ type: 'set-boundary-visibility', visibility }),
      toggleBoundary: (level: keyof BoundaryVisibility) =>
        dispatch({ type: 'toggle-boundary', level }),
      setShowLabels: (showLabels: boolean) => dispatch({ type: 'set-show-labels', showLabels }),
      setLabelScope: (labelScope: LabelScope) => dispatch({ type: 'set-label-scope', labelScope }),
      setLabelContentMode: (labelContentMode: LabelContentMode) =>
        dispatch({ type: 'set-label-content-mode', labelContentMode }),
      setLabelSizePreset: (labelSizePreset: LabelSizePreset) =>
        dispatch({ type: 'set-label-size-preset', labelSizePreset }),
      setLabelFontSizePx: (labelFontSizePx: number) =>
        dispatch({ type: 'set-label-font-size-px', labelFontSizePx }),
      resetLabelFontSize: () => dispatch({ type: 'reset-label-font-size' }),
      setLabelHaloEnabled: (labelHaloEnabled: boolean) =>
        dispatch({ type: 'set-label-halo-enabled', labelHaloEnabled }),
      setLabelHideOnCollision: (labelHideOnCollision: boolean) =>
        dispatch({ type: 'set-label-hide-on-collision', labelHideOnCollision }),
      setOrganizationLegend: (organizationLegend: OrganizationLegendSettings) =>
        dispatch({ type: 'set-organization-legend', organizationLegend }),
      updateOrganizationLegend: (patch: Partial<OrganizationLegendSettings>) =>
        dispatch({ type: 'update-organization-legend', patch }),
      setOrganizationLegendEnabled: (enabled: boolean) =>
        dispatch({ type: 'update-organization-legend', patch: { enabled } }),
      setOrganizationLegendLabelMode: (labelMode: OrganizationLegendLabelMode) =>
        dispatch({ type: 'update-organization-legend', patch: { labelMode } }),
      setActiveExportPresetKey: (activeExportPresetKey: string) =>
        dispatch({ type: 'set-active-export-preset-key', activeExportPresetKey }),
      setSelectedPolygon: (polygon: HoveredPolygon | null) =>
        dispatch({ type: 'set-selected-polygon', polygon }),
      setFocusedRegion: (regionId: string) =>
        dispatch({ type: 'set-focused-region', regionId }),
      clearFocusedRegion: () => dispatch({ type: 'clear-focused-region' }),
      validateFocusedRegion: (validRegionIds: string[]) =>
        dispatch({ type: 'validate-focused-region', validRegionIds }),
    }),
    [dispatch],
  )
}
