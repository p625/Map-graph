import {
  DEFAULT_YEAR_COLOR_PALETTE,
  SUPERVISION_PLAN_VERSION,
  type SupervisionPlan,
  type SupervisionPlanYearConfig,
} from './types'

export function createDefaultYearConfigs(baseYear = new Date().getFullYear()): SupervisionPlanYearConfig[] {
  return [0, 1, 2, 3].map((offset, index) => ({
    year: baseYear + offset,
    color: DEFAULT_YEAR_COLOR_PALETTE[index % DEFAULT_YEAR_COLOR_PALETTE.length]!,
    isActive: true,
  }))
}

export function createDefaultSupervisionPlan(baseYear = new Date().getFullYear()): SupervisionPlan {
  const now = new Date().toISOString()
  return {
    version: SUPERVISION_PLAN_VERSION,
    name: `Plán supervizí ${baseYear}–${baseYear + 3}`,
    assignments: {},
    years: createDefaultYearConfigs(baseYear),
    updatedAt: now,
  }
}
