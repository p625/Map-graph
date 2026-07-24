import { useMemo } from 'react'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../domain/organization/organizationLegend'
import {
  computeAutoColumnCount,
  distributeItemsRowMajor,
} from '../../domain/organization/organizationLegendLayout'
import type { OrganizationalLegendStyleTokens } from '../../domain/organization/organizationLegendStyle'
import {
  extractLegendStyleTokens,
  layoutStyleFromTokens,
} from '../../domain/organization/organizationLegendStyle'
import { OrganizationLegendItemRow } from './OrganizationLegendItemRow'

interface OrganizationLegendContentProps {
  items: OrganizationLegendItem[]
  settings: OrganizationLegendSettings
  width: number
  styleTokens?: OrganizationalLegendStyleTokens
  className?: string
}

export function estimateLegendContentHeight(
  items: OrganizationLegendItem[],
  settings: OrganizationLegendSettings,
  width: number,
  styleTokens?: OrganizationalLegendStyleTokens,
): number {
  const tokens = styleTokens ?? extractLegendStyleTokens(settings.layout)
  const layout = layoutStyleFromTokens(tokens, width, Math.max(80, width * 0.4), settings.layout)
  const columnCount = computeAutoColumnCount(
    layout,
    items,
    settings.labelMode,
    settings.showWorkplaceCount,
  )
  const rows = Math.max(1, Math.ceil(items.length / Math.max(1, columnCount)))
  const rowHeight = tokens.itemFontSize * tokens.lineHeight + tokens.sectionGap
  return tokens.paddingY * 2 + rows * rowHeight
}

export function OrganizationLegendContent({
  items,
  settings,
  width,
  styleTokens,
  className = '',
}: OrganizationLegendContentProps) {
  const tokens = styleTokens ?? extractLegendStyleTokens(settings.layout)

  const layout = useMemo(
    () =>
      layoutStyleFromTokens(
        tokens,
        width,
        estimateLegendContentHeight(items, settings, width, tokens),
        settings.layout,
      ),
    [items, settings, tokens, width],
  )

  const columnCount = useMemo(
    () => computeAutoColumnCount(layout, items, settings.labelMode, settings.showWorkplaceCount),
    [items, layout, settings.labelMode, settings.showWorkplaceCount],
  )

  const orderedItems = useMemo(
    () => distributeItemsRowMajor(items, columnCount),
    [columnCount, items],
  )

  const background =
    tokens.backgroundMode === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'transparent'

  return (
    <div
      className={className}
      style={{
        width,
        background,
        padding: `${tokens.paddingY}px ${tokens.paddingX}px`,
        boxSizing: 'border-box',
        borderRadius: tokens.borderRadius,
      }}
      data-layer="organization-legend-content"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          columnGap: tokens.columnGap,
          rowGap: tokens.sectionGap,
        }}
      >
        {orderedItems.map((item) => (
          <OrganizationLegendItemRow
            key={item.leaderId}
            item={item}
            labelMode={settings.labelMode}
            showWorkplaceCount={settings.showWorkplaceCount}
            styleTokens={tokens}
          />
        ))}
      </div>
    </div>
  )
}
