import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapRegionalOfficeRow,
  mapWorkplaceRow,
} from './lib/column-mapper.ts'
import { writeSeedFiles } from './lib/seed-writer.ts'
import { getSheetLabel, readWorkbook } from './lib/xlsx-reader.ts'
import {
  formatIssues,
  parseRegionalOffices,
  parseWorkplaces,
} from './lib/validators.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const workbookPath = path.join(rootDir, 'data', 'raw', 'workplaces.xlsx')

function logInfo(message: string): void {
  console.log(`ℹ ${message}`)
}

function logSuccess(message: string): void {
  console.log(`✓ ${message}`)
}

function logWarning(message: string): void {
  console.warn(`⚠ ${message}`)
}

function logError(message: string): void {
  console.error(`✗ ${message}`)
}

async function main(): Promise<void> {
  logInfo(`Načítám ${path.relative(rootDir, workbookPath)}`)

  const workbook = await readWorkbook(workbookPath)

  if (workbook.sheetNames.length === 0) {
    logError('Soubor neobsahuje žádný list.')
    process.exit(1)
  }

  const workplaceRows = workbook.getSheetRows(0)
  const workplaceResult = parseWorkplaces(workplaceRows, mapWorkplaceRow)

  if (workplaceResult.issues.length > 0) {
    logError(`workplaces.xlsx — ${workplaceResult.issues.length} chyb:`)
    for (const line of formatIssues(workplaceResult.issues)) {
      logError(line)
    }
    logError('Import přerušen. Seed soubory nebyly přepsány.')
    process.exit(1)
  }

  for (const warning of workplaceResult.warnings) {
    logWarning(warning)
  }

  logSuccess(
    `workplaces.xlsx — ${getSheetLabel(0, workbook.sheetNames)}: ${workplaceResult.data.length} pracovišť OPŽL`,
  )

  let regionalOffices = [] as Awaited<
    ReturnType<typeof parseRegionalOffices>
  >['data']

  if (workbook.sheetNames.length >= 2) {
    const regionalRows = workbook.getSheetRows(1)
    const regionalResult = parseRegionalOffices(regionalRows, mapRegionalOfficeRow)

    if (regionalResult.issues.length > 0) {
      logError(`workplaces.xlsx — list 1: ${regionalResult.issues.length} chyb:`)
      for (const line of formatIssues(regionalResult.issues)) {
        logError(line)
      }
      logWarning('Regionální odbory nebyly importovány — pokračuji pouze s OPŽL.')
    } else {
      regionalOffices = regionalResult.data
      logSuccess(
        `workplaces.xlsx — ${getSheetLabel(1, workbook.sheetNames)}: ${regionalOffices.length} regionálních odborů`,
      )
    }
  } else {
    logInfo('List 1 (regionální odbory) nenalezen — přeskakuji.')
  }

  const { workplacesPath, regionalOfficesPath } = await writeSeedFiles(
    rootDir,
    workplaceResult.data,
    regionalOffices,
  )

  logSuccess(`Vygenerováno: ${path.relative(rootDir, workplacesPath)}`)
  logSuccess(`Vygenerováno: ${path.relative(rootDir, regionalOfficesPath)}`)
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
