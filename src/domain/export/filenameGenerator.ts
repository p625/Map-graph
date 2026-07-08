function slugify(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function generateExportFilename(params: {
  datasetName?: string
  columnName?: string
  date?: Date
}): string {
  const parts = ['map-graph']
  if (params.datasetName) {
    const slug = slugify(params.datasetName)
    if (slug) parts.push(slug)
  }
  if (params.columnName) {
    const slug = slugify(params.columnName)
    if (slug) parts.push(slug)
  }
  const date = params.date ?? new Date()
  parts.push(date.toISOString().slice(0, 10))
  return `${parts.join('-')}.png`
}
