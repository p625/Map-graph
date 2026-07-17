import type { LabelContentMode } from '../labels/labelEngine'
import {
  DEFAULT_LABEL_FONT_SIZES,
  DEFAULT_LABEL_VISIBILITY,
  sanitizeLabelFontSizes,
  sanitizeLabelVisibility,
  type MapLabelFontSizes,
  type MapLabelVisibility,
} from '../labels/labelSettings'
import type { ExportMapScope } from '../region/types'
import type { BoundaryVisibility } from '../territory/types'
import type { ExportPresetId, ExportQuality } from './exportPresets'

export interface MapTemplateLabelVisibility {
  workplace: boolean
  region: boolean
  district: boolean
}

export interface MapTemplateLabelFontSizes {
  workplace: number
  region: number
  district: number
}

export function templateVisibilityToDomain(
  value: MapTemplateLabelVisibility | undefined,
  legacyScope?: string,
): MapLabelVisibility {
  if (value) {
    return sanitizeLabelVisibility({
      showWorkplaceLabels: value.workplace,
      showRegionLabels: value.region,
      showDistrictLabels: value.district,
    })
  }
  return sanitizeLabelVisibility(undefined, legacyScope as 'none' | 'workplace' | 'region' | 'district')
}

export function domainVisibilityToTemplate(value: MapLabelVisibility): MapTemplateLabelVisibility {
  return {
    workplace: value.showWorkplaceLabels,
    region: value.showRegionLabels,
    district: value.showDistrictLabels,
  }
}

export function templateFontSizesToDomain(
  value: MapTemplateLabelFontSizes | undefined,
  legacyWorkplacePx?: number,
): MapLabelFontSizes {
  if (value) {
    return sanitizeLabelFontSizes({
      workplaceFontSizePx: value.workplace,
      regionFontSizePx: value.region,
      districtFontSizePx: value.district,
    })
  }
  return sanitizeLabelFontSizes(undefined, legacyWorkplacePx)
}

export function domainFontSizesToTemplate(value: MapLabelFontSizes): MapTemplateLabelFontSizes {
  return {
    workplace: value.workplaceFontSizePx,
    region: value.regionFontSizePx,
    district: value.districtFontSizePx,
  }
}

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
  /** @deprecated použij labelVisibility */
  labelScope?: string
  labelVisibility: MapTemplateLabelVisibility
  labelContentMode: LabelContentMode
  labelFontSizes: MapTemplateLabelFontSizes
  boundaryVisibility: BoundaryVisibility
  pluginId?: string
  themeId?: string
  columnKey?: string | null
  regionFocusEnabled?: boolean
  focusedRegionId?: string | null
  exportScope?: ExportMapScope
  exportPresetId?: string | null
  createdAt: string
  updatedAt: string
}

export const DEFAULT_TEMPLATE_LABEL_VISIBILITY: MapTemplateLabelVisibility = {
  workplace: DEFAULT_LABEL_VISIBILITY.showWorkplaceLabels,
  region: DEFAULT_LABEL_VISIBILITY.showRegionLabels,
  district: DEFAULT_LABEL_VISIBILITY.showDistrictLabels,
}

export const DEFAULT_TEMPLATE_LABEL_FONT_SIZES: MapTemplateLabelFontSizes = {
  workplace: DEFAULT_LABEL_FONT_SIZES.workplaceFontSizePx,
  region: DEFAULT_LABEL_FONT_SIZES.regionFontSizePx,
  district: DEFAULT_LABEL_FONT_SIZES.districtFontSizePx,
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
  labelVisibility: DEFAULT_TEMPLATE_LABEL_VISIBILITY,
  labelContentMode: 'name',
  labelFontSizes: DEFAULT_TEMPLATE_LABEL_FONT_SIZES,
  boundaryVisibility: DEFAULT_BOUNDARY_VISIBILITY,
  exportScope: 'country',
  exportPresetId: null,
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
      .map((item) => {
        const legacyScope = item.labelScope as string | undefined
        const labelVisibility: MapTemplateLabelVisibility = item.labelVisibility
          ? {
              workplace: Boolean(item.labelVisibility.workplace),
              region: Boolean(item.labelVisibility.region),
              district: Boolean(item.labelVisibility.district),
            }
          : domainVisibilityToTemplate(templateVisibilityToDomain(undefined, legacyScope))
        const labelFontSizes = item.labelFontSizes
          ? {
              workplace: Number(item.labelFontSizes.workplace) || DEFAULT_TEMPLATE_LABEL_FONT_SIZES.workplace,
              region: Number(item.labelFontSizes.region) || DEFAULT_TEMPLATE_LABEL_FONT_SIZES.region,
              district: Number(item.labelFontSizes.district) || DEFAULT_TEMPLATE_LABEL_FONT_SIZES.district,
            }
          : DEFAULT_TEMPLATE_LABEL_FONT_SIZES

        return {
          ...DEFAULT_MAP_TEMPLATE,
          ...item,
          id: String(item.id ?? crypto.randomUUID()),
          name: String(item.name ?? 'Šablona'),
          boundaryVisibility: {
            ...DEFAULT_BOUNDARY_VISIBILITY,
            ...(item.boundaryVisibility ?? {}),
          },
          labelContentMode: item.labelContentMode ?? 'name',
          labelVisibility,
          labelFontSizes,
          exportPresetId: item.exportPresetId ?? null,
        }
      })
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
