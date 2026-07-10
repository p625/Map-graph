import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWorkbook } from './lib/xlsx-reader.ts'
import { seedOrganizationFromWorkplaces, parseAndPreviewSync } from '../src/domain/organization/organizationSync.ts'
import { totalChanges } from '../src/domain/organization/changePreview.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

const filePath = process.argv[2] ?? defaultFile

async function main() {
  console.log(`Synchronizace organizace — preview\nSoubor: ${filePath}\n`)

  const workbook = await readWorkbook(filePath)
  const rows = workbook.getSheetRows(0)
  const current = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, current, path.basename(filePath))

  console.log('=== Audit Rules ===')
  console.log(
    `Chyby: ${preview.audit.errorCount} | Varování: ${preview.audit.warningCount} | Návrhy: ${preview.audit.suggestionCount}`,
  )
  console.log(`Lze pokračovat: ${preview.audit.canProceed ? 'ano' : 'ne'}\n`)

  for (const issue of preview.audit.issues) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`)
  }

  console.log('\n=== Change Preview ===')
  console.log(`Celkem změn: ${totalChanges(preview.changes)}`)
  console.log(`Regiony: +${preview.changes.regions.new.length}`)
  console.log(`Vedoucí: +${preview.changes.leaders.new.length}`)
  console.log(
    `Pracoviště: +${preview.changes.workplaces.new.length}, konflikty ${preview.changes.workplaces.conflicting.length}`,
  )
  console.log(
    `Okresy: změněno ${preview.changes.districtAssignments.changed.length}, nově ${preview.changes.districtAssignments.new.length}`,
  )

  if (!preview.audit.canProceed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
