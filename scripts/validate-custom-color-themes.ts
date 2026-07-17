/**
 * Validace vlastních barevných témat a gradientů (Phase 5E).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { districts } from '../src/data/seed/districts.ts'
import { workplaces as seedWorkplaces } from '../src/data/seed/workplaces.ts'
import {
  buildSequentialScaleFromStops,
  interpolateColorWithStops,
  interpolateRgb,
} from '../src/domain/color-themes/colorInterpolation.ts'
import {
  buildBuiltinColorThemes,
  builtinColorThemeIdFromVisualizationThemeId,
} from '../src/domain/color-themes/builtinColorThemes.ts'
import {
  draftFromColorTheme,
  findColorThemeById,
  getFallbackColorThemeId,
  resolveActiveColorTheme,
  resolveTemplateColorThemeId,
} from '../src/domain/color-themes/colorThemeRegistry.ts'
import {
  createCustomColorThemeId,
  sanitizeCustomColorTheme,
} from '../src/domain/color-themes/customColorThemeSchema.ts'
import {
  createTwoStopTheme,
  CUSTOM_COLOR_THEMES_STORAGE_KEY,
  CUSTOM_DRAFT_COLOR_THEME_ID,
  type MapColorTheme,
} from '../src/domain/color-themes/types.ts'
import {
  mergeOrganizationSnapshots,
  parseAndPreviewSync,
  seedOrganizationFromWorkplaces,
} from '../src/domain/organization/organizationSync.ts'
import { choroplethPlugin } from '../src/domain/visualization/plugins/choroplethPlugin.ts'
import { classicTheme } from '../src/domain/visualization/themes/classic.ts'
import type { VisualizationContext } from '../src/domain/visualization/types.ts'
import { WORKSPACE_MODULE_KEYS } from '../src/domain/workspace/workspaceBackup.ts'
import { readWorkbook } from './lib/xlsx-reader.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orgFile = path.join(__dirname, '..', 'data', 'raw', 'organizace.xlsx')

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function makeCustomTheme(name: string, min: string, max: string): MapColorTheme {
  const now = new Date().toISOString()
  return {
    id: createCustomColorThemeId(),
    name,
    source: 'custom',
    ...createTwoStopTheme(min, max),
    createdAt: now,
    updatedAt: now,
  }
}

async function main() {
  const minColor = '#e8f1ff'
  const maxColor = '#123a78'
  const customTheme = makeCustomTheme('Test gradient', minColor, maxColor)
  const customThemes = [customTheme]

  check('builtin-themes-exist', buildBuiltinColorThemes().length >= 5, `${buildBuiltinColorThemes().length}`)
  check(
    'draft-not-persisted-as-theme',
    !customThemes.some((theme) => theme.id === CUSTOM_DRAFT_COLOR_THEME_ID),
    CUSTOM_DRAFT_COLOR_THEME_ID,
  )

  const draftResolved = resolveActiveColorTheme(CUSTOM_DRAFT_COLOR_THEME_ID, customThemes, {
    minColor,
    maxColor,
  })
  check('draft-resolves-live', draftResolved.isDraft && draftResolved.stops[0]?.color === minColor, draftResolved.stops[0]?.color ?? '')

  const savedResolved = resolveActiveColorTheme(customTheme.id, customThemes, null)
  check('custom-theme-resolves', savedResolved.sequentialScale.length >= 2, `${savedResolved.sequentialScale.length}`)

  check(
    'min-uses-min-color',
    interpolateColorWithStops(10, 100, 10, customTheme.stops) === minColor,
    interpolateColorWithStops(10, 100, 10, customTheme.stops),
  )
  check(
    'max-uses-max-color',
    interpolateColorWithStops(10, 100, 100, customTheme.stops) === maxColor,
    interpolateColorWithStops(10, 100, 100, customTheme.stops),
  )

  const midColor = interpolateColorWithStops(0, 100, 50, customTheme.stops)
  check(
    'mid-interpolated',
    midColor !== minColor && midColor !== maxColor,
    midColor,
  )

  check(
    'clamp-below-min',
    interpolateColorWithStops(10, 100, 0, customTheme.stops) === minColor,
    interpolateColorWithStops(10, 100, 0, customTheme.stops),
  )
  check(
    'clamp-above-max',
    interpolateColorWithStops(10, 100, 500, customTheme.stops) === maxColor,
    interpolateColorWithStops(10, 100, 500, customTheme.stops),
  )

  const equalMinMax = interpolateColorWithStops(42, 42, 42, customTheme.stops)
  check('equal-min-max-stable', equalMinMax === interpolateRgb(minColor, maxColor, 0.5), equalMinMax)

  const serialized = JSON.stringify({ version: 1, themes: customThemes })
  const parsed = JSON.parse(serialized) as { themes: unknown[] }
  const reloaded = parsed.themes
    .map((item) => sanitizeCustomColorTheme(item))
    .filter((item): item is MapColorTheme => item !== null)
  check('persistence-reload', reloaded.length === 1 && reloaded[0]?.name === customTheme.name, `${reloaded.length}`)

  check('sanitize-valid-theme', sanitizeCustomColorTheme(customTheme) !== null, customTheme.name)
  check('reject-invalid-theme', sanitizeCustomColorTheme({ id: 'bad', name: '', stops: [] }) === null, 'invalid rejected')

  const missingActive = resolveActiveColorTheme('missing-theme-id', customThemes, null)
  check(
    'missing-active-fallback',
    missingActive.id === getFallbackColorThemeId(),
    missingActive.id,
  )

  const templateResolved = resolveTemplateColorThemeId(customTheme.id, customThemes)
  check('template-color-theme-id', templateResolved.colorThemeId === customTheme.id, templateResolved.colorThemeId)
  const templateFallback = resolveTemplateColorThemeId('custom-gradient-deleted', customThemes)
  check('template-missing-fallback', templateFallback.usedFallback, String(templateFallback.usedFallback))

  const workbook = await readWorkbook(orgFile)
  const rows = workbook.getSheetRows(0)
  const seed = seedOrganizationFromWorkplaces()
  const preview = parseAndPreviewSync(rows, seed, 'organizace.xlsx')
  const merged = mergeOrganizationSnapshots(seed, preview.incoming)
  const activeWorkplaces = merged.workplaces
    .filter((wp) => !wp.absentFromSync)
    .map((wp) => {
      const seedWp = seedWorkplaces.find((item) => item.id === wp.id)
      return { id: wp.id, code: seedWp?.code ?? wp.id, name: wp.name }
    })

  const districtAssignments: Record<string, string> = {}
  for (const assignment of merged.districtAssignments) {
    districtAssignments[assignment.districtId] = assignment.workplaceId
  }

  const records = activeWorkplaces.slice(0, 5).map((wp, index) => ({
    id: `rec-${index}`,
    datasetId: 'test',
    workplaceId: wp.id,
    matchStatus: 'matched' as const,
    values: { metric: index * 25 },
  }))

  const resolved = resolveActiveColorTheme(customTheme.id, customThemes, null)
  const theme = {
    ...classicTheme,
    sequentialScale: resolved.sequentialScale,
    colorStops: resolved.stops,
  }

  const context: VisualizationContext = {
    districts,
    workplaces: activeWorkplaces,
    regionalOffices: [],
    districtWorkplaceAssignments: districtAssignments,
    workplaceRegionalAssignments: {},
    dataset: {
      id: 'test',
      name: 'Test',
      source: 'manual',
      importedAt: new Date().toISOString(),
      status: 'ready',
      columns: [{ id: 'c1', key: 'metric', name: 'Metrika', type: 'number', nullable: false }],
      recordCount: records.length,
      matchedCount: records.length,
      unmatchedCount: 0,
    },
    records,
    column: { id: 'c1', key: 'metric', name: 'Metrika', type: 'number', nullable: false },
    theme,
  }

  const colors = choroplethPlugin.resolveColors(context)
  const legend = choroplethPlugin.buildLegend(context)
  const firstDistrict = districts[0]!
  const firstWorkplaceId = districtAssignments[firstDistrict.id]
  const firstRecordValue = records.find((record) => record.workplaceId === firstWorkplaceId)?.values.metric as number

  check(
    'map-uses-custom-gradient',
    colors[firstDistrict.id]?.fill === interpolateColorWithStops(0, 100, firstRecordValue, customTheme.stops),
    colors[firstDistrict.id]?.fill ?? '',
  )
  check(
    'legend-scale-parity',
    legend.scale?.colors.join(',') === theme.sequentialScale.join(','),
    `${legend.scale?.colors.length ?? 0}`,
  )

  check(
    'workspace-backup-has-custom-themes-key',
    WORKSPACE_MODULE_KEYS.customColorThemes === CUSTOM_COLOR_THEMES_STORAGE_KEY,
    WORKSPACE_MODULE_KEYS.customColorThemes,
  )

  check(
    'round-trip-draft-colors',
    JSON.stringify(draftFromColorTheme(customTheme)) === JSON.stringify({ minColor, maxColor }),
    'draft colors',
  )

  check(
    'builtin-id-stable',
    findColorThemeById(builtinColorThemeIdFromVisualizationThemeId('classic'), [])?.source === 'builtin',
    builtinColorThemeIdFromVisualizationThemeId('classic'),
  )

  const scale = buildSequentialScaleFromStops(createTwoStopTheme(minColor, maxColor).stops)
  check('legend-gradient-steps', scale[0] === minColor && scale[scale.length - 1] === maxColor, `${scale.length}`)

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-custom-color-themes ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
