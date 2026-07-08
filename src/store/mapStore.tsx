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
}

type MapAction =
  | { type: 'set-plugin'; pluginId: string }
  | { type: 'set-dataset'; datasetId: string | null }
  | { type: 'set-column'; columnKey: string | null }
  | { type: 'set-theme'; themeId: string }
  | { type: 'set-hovered-polygon'; polygon: HoveredPolygon | null }

const MAP_STORAGE_KEY = 'map-graph-map-v2'

const initialState: MapState = {
  pluginId: 'neutral',
  datasetId: null,
  columnKey: null,
  themeId: defaultThemeId,
  hoveredPolygon: null,
}

function loadInitialMapState(): MapState {
  return loadJson<MapState>(MAP_STORAGE_KEY, initialState)
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
    default:
      return state
  }
}

const MapStateContext = createContext<MapState | null>(null)
const MapDispatchContext = createContext<Dispatch<MapAction> | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapReducer, undefined, loadInitialMapState)

  useEffect(() => {
    saveJson(MAP_STORAGE_KEY, { ...state, hoveredPolygon: null })
  }, [state.pluginId, state.datasetId, state.columnKey, state.themeId])

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
    }),
    [dispatch],
  )
}
