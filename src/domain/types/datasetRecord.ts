import type { WorkplaceId } from './assignment'

export type MatchStatus = 'matched' | 'unmatched' | 'manual'

export interface DatasetRecord {
  id: string
  datasetId: string
  workplaceId: WorkplaceId | null
  matchStatus: MatchStatus
  rawLabel?: string
  values: Record<string, unknown>
}
