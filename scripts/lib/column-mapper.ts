const WORKPLACE_COLUMN_ALIASES: Record<string, string[]> = {
  code: ['code', 'kod', 'cislo', 'id', 'číslo'],
  name: [
    'name',
    'nazev',
    'název',
    'pracoviste',
    'pracoviště',
    'opzl',
    'opžl',
    'cislo supervize',
    'číslo supervize',
    'cislo supervize:',
    'číslo supervize:',
  ],
  shortName: ['shortname', 'zkratka', 'kratky nazev', 'krátký název'],
}

const REGIONAL_OFFICE_COLUMN_ALIASES: Record<string, string[]> = {
  code: ['code', 'kod', 'cislo', 'id', 'číslo'],
  name: [
    'name',
    'nazev',
    'název',
    'ro',
    'regionalni odbor',
    'regionální odbor',
  ],
  nuts2Code: ['nuts2code', 'nuts2', 'nuts2_kod', 'nuts2_kód'],
  nuts2Name: ['nuts2name', 'nuts2_nazev', 'nuts2_název', 'nuts2 nazev', 'nuts2 název'],
}

function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizeColumnName(column: string): string {
  return removeDiacritics(column.trim().toLowerCase()).replace(/:$/, '')
}

function buildAliasLookup(
  aliases: Record<string, string[]>,
): Map<string, string> {
  const lookup = new Map<string, string>()

  for (const [canonical, names] of Object.entries(aliases)) {
    for (const name of names) {
      lookup.set(normalizeColumnName(name), canonical)
    }
  }

  return lookup
}

const workplaceLookup = buildAliasLookup(WORKPLACE_COLUMN_ALIASES)
const regionalOfficeLookup = buildAliasLookup(REGIONAL_OFFICE_COLUMN_ALIASES)

export function mapRowColumns(
  row: Record<string, unknown>,
  lookup: Map<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {}

  for (const [column, value] of Object.entries(row)) {
    const canonical = lookup.get(normalizeColumnName(column))
    if (!canonical) continue

    const text = String(value ?? '').trim()
    if (text) {
      mapped[canonical] = text
    }
  }

  return mapped
}

export function mapWorkplaceRow(
  row: Record<string, unknown>,
): Record<string, string> {
  return mapRowColumns(row, workplaceLookup)
}

export function mapRegionalOfficeRow(
  row: Record<string, unknown>,
): Record<string, string> {
  return mapRowColumns(row, regionalOfficeLookup)
}
