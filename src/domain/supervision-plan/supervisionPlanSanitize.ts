import { createDefaultSupervisionPlan } from './supervisionPlanDefaults'
import {
  SUPERVISION_PLAN_VERSION,
  type SupervisionPlan,
  type SupervisionPlanAssignment,
  type SupervisionPlanYearConfig,
} from './types'

function sanitizeYearConfig(value: Partial<SupervisionPlanYearConfig> | undefined): SupervisionPlanYearConfig | null {
  if (!value || typeof value.year !== 'number' || !Number.isFinite(value.year)) return null
  const year = Math.round(value.year)
  if (year < 2000 || year > 2100) return null
  const color = typeof value.color === 'string' && value.color.length > 0 ? value.color : '#94a3b8'
  return {
    year,
    color,
    label: typeof value.label === 'string' && value.label.length > 0 ? value.label : undefined,
    isActive: value.isActive !== false,
  }
}

function sanitizeAssignment(
  workplaceId: string,
  value: Partial<SupervisionPlanAssignment> | undefined,
  validYears: Set<number>,
): SupervisionPlanAssignment | null {
  if (!value) return null
  const plannedYear =
    value.plannedYear === null || value.plannedYear === undefined
      ? null
      : validYears.has(Math.round(value.plannedYear))
        ? Math.round(value.plannedYear)
        : null
  return {
    workplaceId,
    plannedYear,
    note: typeof value.note === 'string' && value.note.length > 0 ? value.note : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

export function sanitizeSupervisionPlan(value: unknown): SupervisionPlan {
  const fallback = createDefaultSupervisionPlan()
  if (!value || typeof value !== 'object') return fallback

  const raw = value as Partial<SupervisionPlan>
  const yearsRaw = Array.isArray(raw.years) ? raw.years : fallback.years
  const yearMap = new Map<number, SupervisionPlanYearConfig>()
  for (const item of yearsRaw) {
    const sanitized = sanitizeYearConfig(item)
    if (sanitized) yearMap.set(sanitized.year, sanitized)
  }
  const years =
    yearMap.size > 0
      ? [...yearMap.values()].sort((a, b) => a.year - b.year)
      : fallback.years
  const validYears = new Set(years.filter((y) => y.isActive).map((y) => y.year))

  const assignments: Record<string, SupervisionPlanAssignment> = {}
  if (raw.assignments && typeof raw.assignments === 'object') {
    for (const [workplaceId, assignment] of Object.entries(raw.assignments)) {
      const sanitized = sanitizeAssignment(workplaceId, assignment, validYears)
      if (sanitized && (sanitized.plannedYear !== null || sanitized.note)) {
        assignments[workplaceId] = sanitized
      }
    }
  }

  return {
    version: SUPERVISION_PLAN_VERSION,
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : fallback.name,
    assignments,
    years,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

export function assertSingleYearPerWorkplace(plan: SupervisionPlan): boolean {
  for (const assignment of Object.values(plan.assignments)) {
    if (assignment.plannedYear !== null && !plan.years.some((y) => y.year === assignment.plannedYear)) {
      return false
    }
  }
  const years = new Set<number>()
  for (const assignment of Object.values(plan.assignments)) {
    if (assignment.plannedYear === null) continue
    if (years.has(assignment.plannedYear)) return false
    years.add(assignment.plannedYear)
  }
  return true
}

export function hasDuplicateYears(years: SupervisionPlanYearConfig[]): boolean {
  const seen = new Set<number>()
  for (const config of years) {
    if (seen.has(config.year)) return true
    seen.add(config.year)
  }
  return false
}
