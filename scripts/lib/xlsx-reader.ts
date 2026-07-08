import { readFile } from 'node:fs'
import { promisify } from 'node:util'
import * as XLSX from 'xlsx'

const readFileAsync = promisify(readFile)

export interface WorkbookData {
  sheetNames: string[]
  getSheetRows: (index: number) => Record<string, unknown>[]
}

export async function readWorkbook(filePath: string): Promise<WorkbookData> {
  const buffer = await readFileAsync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  return {
    sheetNames: workbook.SheetNames,
    getSheetRows(index: number) {
      const sheetName = workbook.SheetNames[index]
      if (!sheetName) return []

      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return []

      return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      })
    },
  }
}

export function getSheetLabel(index: number, sheetNames: string[]): string {
  const name = sheetNames[index]
  return name ? `list ${index} "${name}"` : `list ${index}`
}
