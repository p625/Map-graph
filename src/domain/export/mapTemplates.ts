import type { LabelContentMode, LabelScope } from '../labels/labelEngine'
import type { ExportMapScope } from '../region/types'
import type { BoundaryVisibility } from '../territory/types'
import type { ExportPresetId, ExportQuality } from './exportPresets'

export interface MapTemplate {
  id: string
  name: string
  presetId: ExportPresetId
  quality: ExportQuality
  title: string
  subtitle: string
  showLegend: boolean
  showDatasetInfo: boolean
  showLabels: boolean
  labelScope: LabelScope
  labelContentMode: LabelContentMode
  boundaryVisibility: BoundaryVisibility
  pluginId?: string
  themeId?: string
  columnKey?: string | null
  regionFocusEnabled?: boolean
  focusedRegionId?: string | null
  exportScope?: ExportMapScope
  createdAt: string
  updatedAt: string
}

export const DEFAULT_BOUNDARY_VISIBILITY: BoundaryVisibility = {
  district: false,
  workplace: false,
  region: false,
}

export const DEFAULT_MAP_TEMPLATE: Omit<MapTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Prezentace 16:9',
  presetId: 'presentation-16-9',
  quality: 'standard',
  title: '',
  subtitle: '',
  showLegend: true,
  showDatasetInfo: true,
  showLabels: true,
  labelScope: 'workplace',
  labelContentMode: 'name',
  boundaryVisibility: DEFAULT_BOUNDARY_VISIBILITY,
  exportScope: 'country',
  regionFocusEnabled: false,
  focusedRegionId: null,
}

const TEMPLATE_STORAGE_KEY = 'map-graph-templates-v1'

export function loadMapTemplates(): MapTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is MapTemplate => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        ...DEFAULT_MAP_TEMPLATE,
        ...item,
        id: String(item.id ?? crypto.randomUUID()),
        name: String(item.name ?? 'Šablona'),
        boundaryVisibility: {
          ...DEFAULT_BOUNDARY_VISIBILITY,
          ...(item.boundaryVisibility ?? {}),
        },
        labelContentMode: item.labelContentMode ?? 'name',
      }))
  } catch {
    return []
  }
}

export function saveMapTemplates(templates: MapTemplate[]): void {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates))
}

export function createMapTemplate(
  partial: Partial<MapTemplate> & Pick<MapTemplate, 'name'>,
): MapTemplate {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...DEFAULT_MAP_TEMPLATE,
    ...partial,
  }
}

export function applyMapTemplate(
  template: MapTemplate,
  defaults: { title: string; subtitle: string },
): MapTemplate {
  return {
    ...template,
    title: template.title || defaults.title,
    subtitle: template.subtitle || defaults.subtitle,
  }
}
