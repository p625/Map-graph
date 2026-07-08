import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

interface TopoGeometry {
  properties: {
    KOD_OKRES: string
    KOD_LAU1: string
    NAZ_LAU1: string
    id?: string
  }
}

const topoPath = path.join(rootDir, 'src/data/geo/cz-districts.topo.json')
const topo = JSON.parse(readFileSync(topoPath, 'utf8')) as {
  objects: { okresy: { geometries: TopoGeometry[] } }
}

const districts = topo.objects.okresy.geometries
  .map((geometry) => {
    const props = geometry.properties
    const code = String(props.KOD_OKRES)
    return {
      id: `district-${code}`,
      code,
      name: String(props.NAZ_LAU1),
      nuts3Code: String(props.KOD_LAU1),
      geoFeatureId: String(props.id ?? props.KOD_LAU1),
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'cs'))

const lines = districts.map(
  (district) =>
    `  { id: ${JSON.stringify(district.id)}, code: ${JSON.stringify(district.code)}, name: ${JSON.stringify(district.name)}, nuts3Code: ${JSON.stringify(district.nuts3Code)}, geoFeatureId: ${JSON.stringify(district.geoFeatureId)} },`,
)

const content = `// AUTO-GENERATED from src/data/geo/cz-districts.topo.json
import type { District } from '../../domain/types/district'

export const districts: District[] = [
${lines.join('\n')}
]
`

const outputPath = path.join(rootDir, 'src/data/seed/districts.ts')
writeFileSync(outputPath, content, 'utf8')
console.log(`Generated ${districts.length} districts -> ${path.relative(rootDir, outputPath)}`)
