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
  DEFAULT_LABEL_FONT_SIZE_PX,
  PRESET_FONT_SIZE_PX,
  sanitizeLabelFontSizePx,
} from '../domain/labels/labelEngine'
import {
  DEFAULT_LABEL_FONT_SIZES,
  DEFAULT_LABEL_VISIBILITY,
  sanitizeDistrictFontSizePx,
  sanitizeLabelFontSizes,
  sanitizeLabelVisibility,
  sanitizeRegionFontSizePx,
  sanitizeWorkplaceFontSizePx,
  type MapLabelFontSizes,
  type MapLabelVisibility,
} from '../domain/labels/labelSettings'
import {
  DEFAULT_LABEL_HALO_SETTINGS,
  sanitizeLabelHaloSettings,
  type LabelHaloStyle,
  type MapLabelHaloSettings,
} from '../domain/labels/labelHaloSettings'
import {
  DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
  sanitizeOrganizationLegendLayout,
  type OrganizationLegendLabelMode,
  type OrganizationLegendSettings,
} from '../domain/organization/organizationLegend'
import { DEFAULT_BOUNDARY_VISIBILITY } from '../domain/export/mapTemplates'
import type { BoundaryVisibility } from '../domain/territory/types'
import type { RegionViewMode } from '../domain/region/types'
import type { SupervisionYearFilter } from '../domain/supervision-plan/types'
import {
  DEFAULT_MAP_EDITOR_VIEW,
  sanitizeMapEditorViewState,
  type MapEditorViewState,
} from '../domain/map/mapEditorViewport'
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
  /** @deprecated použij labelVisibility */
  labelScope: LabelScope
  labelVisibility: MapLabelVisibility
  labelContentMode: LabelContentMode
  labelSizePreset: LabelSizePreset
  /** @deprecated použij labelFontSizes.workplaceFontSizePx */
  labelFontSizePx: number
  labelFontSizes: MapLabelFontSizes
  /** @deprecated použij labelHaloSettings */
  labelHaloEnabled: boolean
  labelHaloSettings: MapLabelHaloSettings
  labelHideOnCollision: boolean
  labelEditMode: boolean
  regionLabelEditMode: boolean
  editorView: MapEditorViewState
  organizationLegend: OrganizationLegendSettings
  activeExportPresetKey: string
  selectedPolygon: HoveredPolygon | null
  focusedRegionId: string | null
  regionViewMode: RegionViewMode
  supervisionYearFilter: SupervisionYearFilter
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
  | { type: 'set-label-visibility'; labelVisibility: MapLabelVisibility }
  | { type: 'update-label-visibility'; patch: Partial<MapLabelVisibility> }
  | { type: 'set-label-content-mode'; labelContentMode: LabelContentMode }
  | { type: 'set-label-size-preset'; labelSizePreset: LabelSizePreset; target?: keyof MapLabelFontSizes }
  | { type: 'set-label-font-size-px'; labelFontSizePx: number }
  | { type: 'set-label-font-sizes'; labelFontSizes: MapLabelFontSizes }
  | { type: 'update-label-font-sizes'; patch: Partial<MapLabelFontSizes> }
  | { type: 'reset-label-font-size'; target?: keyof MapLabelFontSizes }
  | { type: 'set-label-halo-enabled'; labelHaloEnabled: boolean }
  | { type: 'set-label-halo-settings'; labelHaloSettings: MapLabelHaloSettings }
  | { type: 'update-label-halo-settings'; patch: Partial<MapLabelHaloSettings> }
  | { type: 'set-label-hide-on-collision'; labelHideOnCollision: boolean }
  | { type: 'set-label-edit-mode'; labelEditMode: boolean }
  | { type: 'set-region-label-edit-mode'; regionLabelEditMode: boolean }
  | { type: 'set-editor-view'; editorView: MapEditorViewState }
  | { type: 'reset-editor-view' }
  | { type: 'set-organization-legend'; organizationLegend: OrganizationLegendSettings }
  | { type: 'update-organization-legend'; patch: Partial<OrganizationLegendSettings> }
  | { type: 'set-active-export-preset-key'; activeExportPresetKey: string }
  | { type: 'set-selected-polygon'; polygon: HoveredPolygon | null }
  | { type: 'set-focused-region'; regionId: string }
  | { type: 'clear-focused-region' }
  | { type: 'validate-focused-region'; validRegionIds: string[] }
  | { type: 'set-supervision-year-filter'; filter: SupervisionYearFilter }

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
  labelVisibility: DEFAULT_LABEL_VISIBILITY,
  labelContentMode: 'name',
  labelSizePreset: 'small',
  labelFontSizePx: PRESET_FONT_SIZE_PX.small,
  labelFontSizes: DEFAULT_LABEL_FONT_SIZES,
  labelHaloEnabled: false,
  labelHaloSettings: DEFAULT_LABEL_HALO_SETTINGS,
  labelHideOnCollision: false,
  labelEditMode: false,
  regionLabelEditMode: false,
  editorView: DEFAULT_MAP_EDITOR_VIEW,
  organizationLegend: DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
  activeExportPresetKey: 'presentation-16-9',
  selectedPolygon: null,
  focusedRegionId: null,
  regionViewMode: 'overview',
  supervisionYearFilter: 'all',
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
    labelVisibility: sanitizeLabelVisibility(
      stored.labelVisibility,
      stored.labelScope ?? 'workplace',
    ),
    labelFontSizes: sanitizeLabelFontSizes(stored.labelFontSizes, stored.labelFontSizePx),
    labelHaloEnabled: stored.labelHaloEnabled ?? false,
    labelHaloSettings: sanitizeLabelHaloSettings(
      stored.labelHaloSettings,
      stored.labelHaloEnabled,
    ),
    labelHideOnCollision: stored.labelHideOnCollision ?? false,
    labelEditMode: stored.labelEditMode ?? false,
    regionLabelEditMode: stored.regionLabelEditMode ?? false,
    editorView: sanitizeMapEditorViewState(stored.editorView),
    organizationLegend: {
      ...DEFAULT_ORGANIZATION_LEGEND_SETTINGS,
      ...(stored.organizationLegend ?? {}),
      position: 'top-right',
      layout: sanitizeOrganizationLegendLayout(stored.organizationLegend?.layout),
    },
    activeExportPresetKey: stored.activeExportPresetKey ?? 'presentation-16-9',
    focusedRegionId: stored.focusedRegionId ?? null,
    regionViewMode: stored.regionViewMode ?? 'overview',
    supervisionYearFilter: stored.supervisionYearFilter ?? 'all',
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
    case 'set-label-scope': {
      const visibility = sanitizeLabelVisibility(undefined, action.labelScope)
      return {
        ...state,
        labelScope: action.labelScope,
        labelVisibility: visibility,
      }
    }
    case 'set-label-visibility':
      return { ...state, labelVisibility: sanitizeLabelVisibility(action.labelVisibility) }
    case 'update-label-visibility':
      return {
        ...state,
        labelVisibility: sanitizeLabelVisibility({
          ...state.labelVisibility,
          ...action.patch,
        }),
      }
    case 'set-label-content-mode':
      return { ...state, labelContentMode: action.labelContentMode }
    case 'set-label-size-preset': {
      const presetPx = PRESET_FONT_SIZE_PX[action.labelSizePreset]
      const target = action.target ?? 'workplaceFontSizePx'
      return {
        ...state,
        labelSizePreset: action.labelSizePreset,
        labelFontSizePx: target === 'workplaceFontSizePx' ? presetPx : state.labelFontSizePx,
        labelFontSizes: {
          ...state.labelFontSizes,
          [target]: presetPx,
        },
      }
    }
    case 'set-label-font-size-px':
      return {
        ...state,
        labelFontSizePx: sanitizeLabelFontSizePx(action.labelFontSizePx),
        labelFontSizes: {
          ...state.labelFontSizes,
          workplaceFontSizePx: sanitizeWorkplaceFontSizePx(action.labelFontSizePx),
        },
      }
    case 'set-label-font-sizes':
      return { ...state, labelFontSizes: sanitizeLabelFontSizes(action.labelFontSizes) }
    case 'update-label-font-sizes':
      return {
        ...state,
        labelFontSizes: sanitizeLabelFontSizes({
          ...state.labelFontSizes,
          ...action.patch,
        }),
      }
    case 'reset-label-font-size': {
      const target = action.target ?? 'workplaceFontSizePx'
      const presetPx = PRESET_FONT_SIZE_PX[state.labelSizePreset] ?? DEFAULT_LABEL_FONT_SIZE_PX
      const resetPx =
        target === 'regionFontSizePx'
          ? DEFAULT_LABEL_FONT_SIZES.regionFontSizePx
          : target === 'districtFontSizePx'
            ? DEFAULT_LABEL_FONT_SIZES.districtFontSizePx
            : presetPx
      return {
        ...state,
        labelFontSizePx: target === 'workplaceFontSizePx' ? resetPx : state.labelFontSizePx,
        labelFontSizes: {
          ...state.labelFontSizes,
          [target]: resetPx,
        },
      }
    }
    case 'set-label-halo-enabled':
      return {
        ...state,
        labelHaloEnabled: action.labelHaloEnabled,
        labelHaloSettings: sanitizeLabelHaloSettings(
          {
            ...state.labelHaloSettings,
            workplace: {
              ...state.labelHaloSettings.workplace,
              enabled: action.labelHaloEnabled,
            },
          },
          action.labelHaloEnabled,
        ),
      }
    case 'set-label-halo-settings':
      return {
        ...state,
        labelHaloSettings: sanitizeLabelHaloSettings(action.labelHaloSettings),
        labelHaloEnabled: action.labelHaloSettings.workplace.enabled,
      }
    case 'update-label-halo-settings':
      return {
        ...state,
        labelHaloSettings: sanitizeLabelHaloSettings({
          ...state.labelHaloSettings,
          ...action.patch,
          workplace: action.patch.workplace
            ? { ...state.labelHaloSettings.workplace, ...action.patch.workplace }
            : state.labelHaloSettings.workplace,
          region: action.patch.region
            ? { ...state.labelHaloSettings.region, ...action.patch.region }
            : state.labelHaloSettings.region,
          district: action.patch.district
            ? { ...state.labelHaloSettings.district, ...action.patch.district }
            : state.labelHaloSettings.district,
        }),
      }
    case 'set-label-hide-on-collision':
      return { ...state, labelHideOnCollision: action.labelHideOnCollision }
    case 'set-label-edit-mode':
      return { ...state, labelEditMode: action.labelEditMode }
    case 'set-region-label-edit-mode':
      return { ...state, regionLabelEditMode: action.regionLabelEditMode }
    case 'set-editor-view':
      return { ...state, editorView: sanitizeMapEditorViewState(action.editorView) }
    case 'reset-editor-view':
      return { ...state, editorView: DEFAULT_MAP_EDITOR_VIEW }
    case 'set-organization-legend':
      return {
        ...state,
        organizationLegend: {
          ...action.organizationLegend,
          position: 'top-right',
          layout: sanitizeOrganizationLegendLayout(action.organizationLegend.layout),
        },
      }
    case 'update-organization-legend':
      return {
        ...state,
        organizationLegend: {
          ...state.organizationLegend,
          ...action.patch,
          position: 'top-right',
          layout: action.patch.layout
            ? sanitizeOrganizationLegendLayout({
                ...state.organizationLegend.layout,
                ...action.patch.layout,
              })
            : state.organizationLegend.layout,
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
        editorView: DEFAULT_MAP_EDITOR_VIEW,
      }
    case 'clear-focused-region':
      return {
        ...state,
        focusedRegionId: null,
        regionViewMode: 'overview',
        hoveredPolygon: null,
        selectedPolygon: null,
        editorView: DEFAULT_MAP_EDITOR_VIEW,
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
    case 'set-supervision-year-filter':
      return { ...state, supervisionYearFilter: action.filter }
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
      labelVisibility: state.labelVisibility,
      labelContentMode: state.labelContentMode,
      labelSizePreset: state.labelSizePreset,
      labelFontSizePx: state.labelFontSizePx,
      labelFontSizes: state.labelFontSizes,
      labelHaloEnabled: state.labelHaloEnabled,
      labelHaloSettings: state.labelHaloSettings,
      labelHideOnCollision: state.labelHideOnCollision,
      labelEditMode: state.labelEditMode,
      regionLabelEditMode: state.regionLabelEditMode,
      editorView: state.editorView,
      organizationLegend: state.organizationLegend,
      activeExportPresetKey: state.activeExportPresetKey,
      focusedRegionId: state.focusedRegionId,
      regionViewMode: state.regionViewMode,
      supervisionYearFilter: state.supervisionYearFilter,
    })
  }, [
    state.pluginId,
    state.datasetId,
    state.columnKey,
    state.themeId,
    state.boundaryVisibility,
    state.showLabels,
    state.labelScope,
    state.labelVisibility,
    state.labelContentMode,
    state.labelSizePreset,
    state.labelFontSizePx,
    state.labelFontSizes,
    state.labelHaloEnabled,
    state.labelHaloSettings,
    state.labelHideOnCollision,
    state.labelEditMode,
    state.regionLabelEditMode,
    state.editorView,
    state.organizationLegend,
    state.activeExportPresetKey,
    state.focusedRegionId,
    state.regionViewMode,
    state.supervisionYearFilter,
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
      setLabelVisibility: (labelVisibility: MapLabelVisibility) =>
        dispatch({ type: 'set-label-visibility', labelVisibility }),
      updateLabelVisibility: (patch: Partial<MapLabelVisibility>) =>
        dispatch({ type: 'update-label-visibility', patch }),
      setShowWorkplaceLabels: (show: boolean) =>
        dispatch({ type: 'update-label-visibility', patch: { showWorkplaceLabels: show } }),
      setShowRegionLabels: (show: boolean) =>
        dispatch({ type: 'update-label-visibility', patch: { showRegionLabels: show } }),
      setShowDistrictLabels: (show: boolean) =>
        dispatch({ type: 'update-label-visibility', patch: { showDistrictLabels: show } }),
      setLabelContentMode: (labelContentMode: LabelContentMode) =>
        dispatch({ type: 'set-label-content-mode', labelContentMode }),
      setLabelSizePreset: (labelSizePreset: LabelSizePreset, target?: keyof MapLabelFontSizes) =>
        dispatch({ type: 'set-label-size-preset', labelSizePreset, target }),
      setLabelFontSizePx: (labelFontSizePx: number) =>
        dispatch({ type: 'set-label-font-size-px', labelFontSizePx }),
      setLabelFontSizes: (labelFontSizes: MapLabelFontSizes) =>
        dispatch({ type: 'set-label-font-sizes', labelFontSizes }),
      updateLabelFontSizes: (patch: Partial<MapLabelFontSizes>) =>
        dispatch({ type: 'update-label-font-sizes', patch }),
      setWorkplaceFontSizePx: (workplaceFontSizePx: number) =>
        dispatch({
          type: 'update-label-font-sizes',
          patch: { workplaceFontSizePx: sanitizeWorkplaceFontSizePx(workplaceFontSizePx) },
        }),
      setRegionFontSizePx: (regionFontSizePx: number) =>
        dispatch({
          type: 'update-label-font-sizes',
          patch: { regionFontSizePx: sanitizeRegionFontSizePx(regionFontSizePx) },
        }),
      setDistrictFontSizePx: (districtFontSizePx: number) =>
        dispatch({
          type: 'update-label-font-sizes',
          patch: { districtFontSizePx: sanitizeDistrictFontSizePx(districtFontSizePx) },
        }),
      resetLabelFontSize: (target?: keyof MapLabelFontSizes) =>
        dispatch({ type: 'reset-label-font-size', target }),
      setLabelHaloEnabled: (labelHaloEnabled: boolean) =>
        dispatch({ type: 'set-label-halo-enabled', labelHaloEnabled }),
      setLabelHaloSettings: (labelHaloSettings: MapLabelHaloSettings) =>
        dispatch({ type: 'set-label-halo-settings', labelHaloSettings }),
      updateLabelHaloSettings: (patch: Partial<MapLabelHaloSettings>) =>
        dispatch({ type: 'update-label-halo-settings', patch }),
      updateWorkplaceHalo: (patch: Partial<LabelHaloStyle>) =>
        dispatch({
          type: 'update-label-halo-settings',
          patch: { workplace: patch as LabelHaloStyle },
        }),
      updateRegionHalo: (patch: Partial<LabelHaloStyle>) =>
        dispatch({
          type: 'update-label-halo-settings',
          patch: { region: patch as LabelHaloStyle },
        }),
      setLabelHideOnCollision: (labelHideOnCollision: boolean) =>
        dispatch({ type: 'set-label-hide-on-collision', labelHideOnCollision }),
      setLabelEditMode: (labelEditMode: boolean) =>
        dispatch({ type: 'set-label-edit-mode', labelEditMode }),
      setRegionLabelEditMode: (regionLabelEditMode: boolean) =>
        dispatch({ type: 'set-region-label-edit-mode', regionLabelEditMode }),
      setEditorView: (editorView: MapEditorViewState) =>
        dispatch({ type: 'set-editor-view', editorView }),
      resetEditorView: () => dispatch({ type: 'reset-editor-view' }),
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
      setSupervisionYearFilter: (filter: SupervisionYearFilter) =>
        dispatch({ type: 'set-supervision-year-filter', filter }),
    }),
    [dispatch],
  )
}
