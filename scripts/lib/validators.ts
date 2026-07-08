import { z } from 'zod'

export const EXPECTED_WORKPLACE_COUNT = 65

const workplaceRowSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'název pracoviště nesmí být prázdný'),
  shortName: z.string().optional(),
})

const regionalOfficeRowSchema = z.object({
  code: z.string().min(1, 'kód regionálního odboru je povinný'),
  name: z.string().min(1, 'název regionálního odboru je povinný'),
  nuts2Code: z.string().optional(),
  nuts2Name: z.string().optional(),
})

export interface ParsedWorkplace {
  id: string
  code: string
  name: string
  shortName?: string
}

export interface ParsedRegionalOffice {
  id: string
  code: string
  name: string
  nuts2Code?: string
  nuts2Name?: string
}

export interface ValidationIssue {
  sheet: 'workplaces' | 'regional-offices'
  row: number
  message: string
}

function padCode(code: string): string {
  return code.padStart(3, '0')
}

function createWorkplaceId(code: string): string {
  return `wp-${padCode(code)}`
}

function createRegionalOfficeId(code: string): string {
  return `ro-${padCode(code)}`
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => String(value ?? '').trim() === '')
}

export function parseWorkplaces(
  rows: Record<string, unknown>[],
  mapRow: (row: Record<string, unknown>) => Record<string, string>,
): { data: ParsedWorkplace[]; issues: ValidationIssue[]; warnings: string[] } {
  const issues: ValidationIssue[] = []
  const warnings: string[] = []
  const data: ParsedWorkplace[] = []
  const usedCodes = new Set<string>()

  let rowNumber = 1

  for (const rawRow of rows) {
    rowNumber += 1
    if (isEmptyRow(rawRow)) continue

    const mapped = mapRow(rawRow)
    const parsed = workplaceRowSchema.safeParse(mapped)

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ')
      issues.push({ sheet: 'workplaces', row: rowNumber, message })
      continue
    }

    const code = parsed.data.code ?? String(data.length + 1)

    if (usedCodes.has(code)) {
      issues.push({
        sheet: 'workplaces',
        row: rowNumber,
        message: `duplicitní kód "${code}"`,
      })
      continue
    }

    usedCodes.add(code)

    const workplace: ParsedWorkplace = {
      id: createWorkplaceId(code),
      code,
      name: parsed.data.name,
    }

    if (parsed.data.shortName) {
      workplace.shortName = parsed.data.shortName
    }

    data.push(workplace)
  }

  if (data.length !== EXPECTED_WORKPLACE_COUNT) {
    warnings.push(
      `očekáváno ${EXPECTED_WORKPLACE_COUNT} pracovišť, nalezeno ${data.length}`,
    )
  }

  return { data, issues, warnings }
}

export function parseRegionalOffices(
  rows: Record<string, unknown>[],
  mapRow: (row: Record<string, unknown>) => Record<string, string>,
): { data: ParsedRegionalOffice[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const data: ParsedRegionalOffice[] = []
  const usedCodes = new Set<string>()

  let rowNumber = 1

  for (const rawRow of rows) {
    rowNumber += 1
    if (isEmptyRow(rawRow)) continue

    const mapped = mapRow(rawRow)
    const parsed = regionalOfficeRowSchema.safeParse(mapped)

    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ')
      issues.push({ sheet: 'regional-offices', row: rowNumber, message })
      continue
    }

    const { code, name, nuts2Code, nuts2Name } = parsed.data

    if (usedCodes.has(code)) {
      issues.push({
        sheet: 'regional-offices',
        row: rowNumber,
        message: `duplicitní kód "${code}"`,
      })
      continue
    }

    usedCodes.add(code)

    const office: ParsedRegionalOffice = {
      id: createRegionalOfficeId(code),
      code,
      name,
    }

    if (nuts2Code) office.nuts2Code = nuts2Code
    if (nuts2Name) office.nuts2Name = nuts2Name

    data.push(office)
  }

  return { data, issues }
}

export function formatIssues(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => {
    const label = issue.sheet === 'workplaces' ? 'OPŽL' : 'RO'
    return `  řádek ${issue.row} (${label}): ${issue.message}`
  })
}
