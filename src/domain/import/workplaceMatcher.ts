import { normalizeText } from '../visualization/colorUtils'
import type { Workplace } from '../types/workplace'
import type { MatchStatus } from '../types/datasetRecord'

export interface MatchResult {
  workplaceId: string | null
  matchStatus: MatchStatus
  matchConfidence?: number
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) matrix[i]![0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0]![j] = j

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      )
    }
  }

  return matrix[a.length]![b.length]!
}

function normalizeWorkplaceLabel(label: string): string {
  return normalizeText(label)
    .replace(/^opzl\s+/, '')
    .replace(/^opžl\s+/, '')
}

export function matchWorkplaceLabel(
  label: string,
  workplaces: Workplace[],
): MatchResult {
  const normalized = normalizeWorkplaceLabel(label)
  if (!normalized) {
    return { workplaceId: null, matchStatus: 'unmatched' }
  }

  const byCode = workplaces.find((workplace) => normalizeText(workplace.code) === normalized)
  if (byCode) {
    return { workplaceId: byCode.id, matchStatus: 'matched', matchConfidence: 1 }
  }

  const byName = workplaces.find(
    (workplace) => normalizeWorkplaceLabel(workplace.name) === normalized,
  )
  if (byName) {
    return { workplaceId: byName.id, matchStatus: 'matched', matchConfidence: 1 }
  }

  let best: Workplace | null = null
  let bestScore = 0

  for (const workplace of workplaces) {
    const candidate = normalizeWorkplaceLabel(workplace.name)
    const distance = levenshtein(normalized, candidate)
    const maxLen = Math.max(normalized.length, candidate.length)
    const confidence = maxLen === 0 ? 0 : 1 - distance / maxLen
    if (confidence > bestScore) {
      bestScore = confidence
      best = workplace
    }
  }

  if (best && bestScore >= 0.8) {
    return {
      workplaceId: best.id,
      matchStatus: 'matched',
      matchConfidence: bestScore,
    }
  }

  return { workplaceId: null, matchStatus: 'unmatched' }
}
