import type {
  DistrictWorkplaceAssignments,
  WorkplaceRegionalAssignments,
} from '../types/assignment'
import type { Dataset } from '../types/dataset'
import type { DatasetColumn } from '../types/datasetColumn'
import type { DatasetRecord } from '../types/datasetRecord'
import type { District } from '../types/district'
import type { RegionalOffice } from '../types/regionalOffice'
import type { Workplace } from '../types/workplace'

import type { VisualizationTheme } from '../visualization/themes/types'

export type DistrictId = string

export interface DistrictStyle {
  fill: string
  opacity?: number
  stroke?: string
}

export type DistrictColorMap = Record<DistrictId, DistrictStyle>

export interface LegendItem {
  id: string
  label: string
  color: string
  count?: number
}

export interface LegendSpec {
  title: string
  items: LegendItem[]
  scale?: {
    min: number
    max: number
    colors: string[]
  }
}

export interface VisualizationContext {
  districts: District[]
  workplaces: Workplace[]
  regionalOffices: RegionalOffice[]
  districtWorkplaceAssignments: DistrictWorkplaceAssignments
  workplaceRegionalAssignments: WorkplaceRegionalAssignments
  dataset?: Dataset
  records?: DatasetRecord[]
  column?: DatasetColumn
  theme: VisualizationTheme
}

export interface VisualizationPlugin {
  id: string
  name: string
  description: string
  requiresDataset: boolean
  requiresColumn: boolean
  supportsColumn: (column: DatasetColumn) => boolean
  resolveColors: (context: VisualizationContext) => DistrictColorMap
  buildLegend: (context: VisualizationContext) => LegendSpec
}
