export interface SupervisionPlanAssignment {
  workplaceId: string
  plannedYear: number | null
  note?: string
  updatedAt: string
}

export interface SupervisionPlanYearConfig {
  year: number
  color: string
  label?: string
  isActive: boolean
}

export interface SupervisionPlan {
  version: number
  name: string
  assignments: Record<string, SupervisionPlanAssignment>
  years: SupervisionPlanYearConfig[]
  updatedAt: string
}

export type SupervisionYearFilter = 'all' | 'unplanned' | number

export interface SupervisionPlanTableFilters {
  search: string
  regionId: string
  leaderId: string
  orgUnitId: string
  plannedYear: '' | 'unplanned' | number
}

export const SUPERVISION_PLAN_STORAGE_KEY = 'map-graph-supervision-plan-v1'
export const SUPERVISION_PLAN_VERSION = 1

export const SUPERVISION_UNPLANNED_COLOR = '#e2e8f0'
export const SUPERVISION_DIMMED_COLOR = '#f1f5f9'
export const SUPERVISION_DIMMED_OPACITY = 0.55

export const DEFAULT_YEAR_COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
]
