import type { OrganizationLegendItem, OrganizationLegendLabelMode } from '../../domain/organization/organizationLegend'
import { resolveOrganizationLegendSegments } from '../../domain/organization/organizationLegendLayout'

interface OrganizationLegendItemRowProps {
  item: OrganizationLegendItem
  labelMode: OrganizationLegendLabelMode
  showWorkplaceCount: boolean
  fontSizePx: number
}

export function OrganizationLegendItemRow({
  item,
  labelMode,
  showWorkplaceCount,
  fontSizePx,
}: OrganizationLegendItemRowProps) {
  const segment = resolveOrganizationLegendSegments(item, labelMode, showWorkplaceCount)
  const swatch = Math.max(8, fontSizePx)

  return (
    <div className="flex min-w-0 items-center gap-1.5" style={{ fontSize: fontSizePx, lineHeight: 1.35 }}>
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-sm border border-slate-300"
        style={{ width: swatch, height: swatch, backgroundColor: item.color }}
      />
      {segment.showDesignation && segment.designation && (
        <span className="shrink-0 font-medium text-slate-800">{segment.designation}</span>
      )}
      {segment.showLeader && segment.leaderName && (
        <span className="truncate text-slate-700">{segment.leaderName}</span>
      )}
      {segment.showCount && (
        <span className="shrink-0 text-slate-500">({segment.workplaceCount})</span>
      )}
    </div>
  )
}
