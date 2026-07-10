import { districts } from '../../data/seed/districts'
import { normalizeText } from '../visualization/colorUtils'

/**
 * Mapuje názvy okresů ze synchronizačního souboru na ID okresů v seed datech.
 * Nepřejmenovává interní entity — pouze překládá vstupní název.
 */
export const DISTRICT_NAME_ALIASES: Record<string, string> = {
  'kraluv dvur': 'Beroun',
  'plzen': 'Plzeň-město',
  'plzeň': 'Plzeň-město',
  'plzen-sever': 'Plzeň-sever',
  'ostrava mesto': 'Ostrava-město',
  'ostrava město': 'Ostrava-město',
}

const districtByNormName = new Map(districts.map((d) => [normalizeText(d.name), d.id]))

export function resolveDistrictId(rawOkresName: string): {
  districtId: string | null
  aliasUsed?: string
} {
  const trimmed = rawOkresName.trim()
  const normalized = normalizeText(trimmed)

  const direct = districtByNormName.get(normalized)
  if (direct) return { districtId: direct }

  const aliasTarget = DISTRICT_NAME_ALIASES[normalized]
  if (aliasTarget) {
    const districtId = districtByNormName.get(normalizeText(aliasTarget)) ?? null
    return { districtId, aliasUsed: aliasTarget }
  }

  return { districtId: null }
}
