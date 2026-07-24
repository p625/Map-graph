import type { OrganizationLegendItem, OrganizationLegendLabelMode } from '../../domain/organization/organizationLegend'
import { resolveOrganizationLegendSegments } from '../../domain/organization/organizationLegendLayout'
import type { OrganizationalLegendStyleTokens } from '../../domain/organization/organizationLegendStyle'

interface OrganizationLegendItemRowProps {
  item: OrganizationLegendItem
  labelMode: OrganizationLegendLabelMode
  showWorkplaceCount: boolean
  fontSizePx?: number
  styleTokens?: OrganizationalLegendStyleTokens
}

export function OrganizationLegendItemRow({
  item,
  labelMode,
  showWorkplaceCount,
  fontSizePx,
  styleTokens,
}: OrganizationLegendItemRowProps) {
  const segment = resolveOrganizationLegendSegments(item, labelMode, showWorkplaceCount)
  const itemFontSize = styleTokens?.itemFontSize ?? fontSizePx ?? 9
  const lineHeight = styleTokens?.lineHeight ?? 1.35
  const markerSize = styleTokens?.markerSize ?? Math.max(8, itemFontSize)
  const markerTextGap = styleTokens?.markerTextGap ?? 6

  return (
    <div
      className="flex min-w-0 items-center"
      style={{
        fontSize: itemFontSize,
        lineHeight,
        gap: markerTextGap,
      }}
    >
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-sm border border-slate-300"
        style={{
          width: markerSize,
          height: markerSize,
          backgroundColor: item.color,
          borderWidth: styleTokens?.markerBorderWidth ?? 1,
        }}
      />
      {segment.showDesignation && segment.designation && (
        <span className="shrink-0 font-medium text-slate-800">{segment.designation}</span>
      )}
      {segment.showLeader && segment.leaderName && (
        <span className="truncate text-slate-700">{segment.leaderName}</span>
      )}
      {segment.showCount && (
        <span
          className="shrink-0 text-slate-500"
          style={{ fontSize: styleTokens?.secondaryFontSize ?? itemFontSize }}
        >
          ({segment.workplaceCount})
        </span>
      )}
    </div>
  )
}
