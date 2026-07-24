/**
 * Validace škálování obsahu organizační legendy (Phase 5F.2).
 */
import {
  DEFAULT_LEGEND_STYLE_TOKENS,
  extractLegendStyleTokens,
  scaleLegendStyleTokens,
} from '../src/domain/organization/organizationLegendStyle.ts'
import { DEFAULT_ORGANIZATION_LEGEND_LAYOUT } from '../src/domain/organization/organizationLegendLayout.ts'

interface Check {
  id: string
  pass: boolean
  detail: string
}

const checks: Check[] = []
function check(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
}

function main() {
  const base = extractLegendStyleTokens(DEFAULT_ORGANIZATION_LEGEND_LAYOUT)
  const half = scaleLegendStyleTokens(base, 0.5)
  const double = scaleLegendStyleTokens(base, 2)

  check(
    'legend-text-scales-down',
    half.itemFontSize < base.itemFontSize,
    `${base.itemFontSize} -> ${half.itemFontSize}`,
  )
  check(
    'legend-text-scales-up',
    double.itemFontSize > base.itemFontSize,
    `${base.itemFontSize} -> ${double.itemFontSize}`,
  )
  check(
    'marker-scales-down',
    half.markerSize < base.markerSize,
    `${base.markerSize} -> ${half.markerSize}`,
  )
  check(
    'spacing-scales-down',
    half.paddingX < base.paddingX && half.itemGap < base.itemGap,
    `padding ${base.paddingX} -> ${half.paddingX}`,
  )
  check(
    'width-unchanged-by-scale',
    base.maxColumns === half.maxColumns,
    'maxColumns stable',
  )
  check(
    'scale-clamped-min',
    scaleLegendStyleTokens(base, 0.1).itemFontSize >= 6,
    String(scaleLegendStyleTokens(base, 0.1).itemFontSize),
  )
  check(
    'scale-clamped-max',
    scaleLegendStyleTokens(base, 5).itemFontSize <= base.itemFontSize * 2.5,
    String(scaleLegendStyleTokens(base, 5).itemFontSize),
  )
  check(
    'default-tokens-defined',
    DEFAULT_LEGEND_STYLE_TOKENS.itemFontSize > 0,
    String(DEFAULT_LEGEND_STYLE_TOKENS.itemFontSize),
  )

  const failed = checks.filter((item) => !item.pass)
  console.log('\n=== validate-export-legend-content-scale ===\n')
  for (const item of checks) {
    console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.id}`)
    if (!item.pass || process.env.VERBOSE) {
      console.log(`       ${item.detail}`)
    }
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main()
