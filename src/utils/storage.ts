import type {
  DistrictWorkplaceAssignments,
} from '../domain/types/assignment'
import type { District } from '../domain/types/district'
import type { Workplace } from '../domain/types/workplace'
import type { Dataset } from '../domain/types/dataset'
import type { DatasetRecord } from '../domain/types/datasetRecord'
import { normalizeText } from '../domain/visualization/colorUtils'

export interface SaveJsonResult {
  ok: boolean
  error?: 'quota' | 'unknown'
  bytes?: number
}

export const LOCAL_STORAGE_SOFT_LIMIT_BYTES = 4_500_000

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

export function estimateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return JSON.stringify(value).length
  }
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

export function saveJson<T>(key: string, value: T): SaveJsonResult {
  try {
    const serialized = JSON.stringify(value)
    localStorage.setItem(key, serialized)
    return { ok: true, bytes: serialized.length }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' }
    }
    return { ok: false, error: 'unknown' }
  }
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function isDatasetStateValid(
  value: unknown,
): value is { datasets: Dataset[]; recordsByDataset: Record<string, DatasetRecord[]> } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as {
    datasets?: unknown
    recordsByDataset?: unknown
  }
  return Array.isArray(candidate.datasets) && typeof candidate.recordsByDataset === 'object'
}
