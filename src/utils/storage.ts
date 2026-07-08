import type { DistrictWorkplaceAssignments } from '../domain/types/assignment'
import type { District } from '../domain/types/district'
import type { Workplace } from '../domain/types/workplace'
import { normalizeText } from '../domain/visualization/colorUtils'

function resolveWorkplaceForDistrict(
  districtName: string,
  workplaceByName: Map<string, string>,
): string | undefined {
  const normalizedDistrict = normalizeText(districtName)

  const exact = workplaceByName.get(normalizedDistrict)
  if (exact) return exact

  for (const [workplaceName, workplaceId] of workplaceByName) {
    if (
      normalizedDistrict.startsWith(`${workplaceName}-`) ||
      normalizedDistrict.startsWith(`${workplaceName} `)
    ) {
      return workplaceId
    }
  }

  return undefined
}

export function buildDefaultDistrictAssignments(
  districts: District[],
  workplaces: Workplace[],
): DistrictWorkplaceAssignments {
  const assignments: DistrictWorkplaceAssignments = {}
  const workplaceByName = new Map(
    workplaces.map((workplace) => [normalizeText(workplace.name), workplace.id]),
  )

  for (const district of districts) {
    const workplaceId = resolveWorkplaceForDistrict(district.name, workplaceByName)
    if (workplaceId) {
      assignments[district.id] = workplaceId
    }
  }

  return assignments
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}
