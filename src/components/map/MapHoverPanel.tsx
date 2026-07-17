import { datasetStatusLabel } from '../../domain/dataset/datasetValidation'
import { getNumericColumnValue, getRecordForDistrict } from '../../domain/visualization/contextUtils'
import type { WorkplaceResolver } from '../../domain/territory/workplaceResolver'
import { useConfigData } from '../../store/configStore'
import { isOrganizationSynced } from '../../store/organizationStore'
import { useMapState } from '../../store/mapStore'
import { useActiveVisualization } from '../../hooks/useVisualization'

function formatHoverValue(
  raw: unknown,
  columnType: string | undefined,
): string {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (columnType === 'number' || columnType === 'percent') {
    const numeric =
      typeof raw === 'number'
        ? raw
        : getNumericColumnValue({ values: { v: raw } }, 'v')
    if (numeric !== null) {
      if (columnType === 'percent') {
        return `${numeric.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %`
      }
      if (Number.isInteger(numeric)) {
        return numeric.toLocaleString('cs-CZ')
      }
      return numeric.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
    }
  }
  return String(raw)
}

export function MapHoverPanel({
  resolver,
  districtInteraction = false,
}: {
  resolver: WorkplaceResolver
  districtInteraction?: boolean
}) {
  const { hoveredPolygon } = useMapState()
  const { context, plugin } = useActiveVisualization()
  const { organizationSnapshot } = useConfigData()
  const orgSynced = isOrganizationSynced(organizationSnapshot)

  if (!hoveredPolygon) {
    return (
      <div className="min-h-[220px] rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
        Najetím na oblast zobrazíte detail okresu, pracoviště a dat.
      </div>
    )
  }

  const workplace = hoveredPolygon.workplaceId
    ? resolver.getWorkplace(hoveredPolygon.workplaceId)
    : null
  const districtNames = hoveredPolygon.districtIds.map(
    (districtId) => resolver.getDistrict(districtId)?.name ?? districtId,
  )
  const representativeDistrictId = hoveredPolygon.districtIds[0] ?? null
  const record = representativeDistrictId
    ? getRecordForDistrict(context, representativeDistrictId)
    : null

  const regionalOffice = workplace
    ? resolver.getRegionForWorkplace(workplace.id)
    : null

  const orgWorkplace = workplace
    ? organizationSnapshot.workplaces.find((wp) => wp.id === workplace.id)
    : null
  const leader = orgWorkplace
    ? organizationSnapshot.leaders.find((item) => item.id === orgWorkplace.leaderId)
    : null
  const orgUnit = orgWorkplace
    ? organizationSnapshot.orgUnits.find((item) => item.id === orgWorkplace.orgUnitId)
    : null

  const showDistrictFirst = districtInteraction || plugin.districtInteraction

  return (
    <div className="min-h-[220px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        {showDistrictFirst
          ? (districtNames[0] ?? 'Neznámý okres')
          : (workplace?.name ?? districtNames[0] ?? 'Neznámá oblast')}
      </h3>
      <dl className="mt-3 space-y-2 text-sm text-slate-600">
        {districtNames.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Okres</dt>
            <dd className="mt-0.5 text-slate-900">{districtNames.join(', ')}</dd>
          </div>
        )}
        {workplace && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pracoviště OPŽL</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{workplace.name}</dd>
          </div>
        )}
        {regionalOffice && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Regionální odbor</dt>
            <dd className="mt-0.5 text-slate-900">{regionalOffice.name}</dd>
          </div>
        )}
        {orgSynced && leader && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Vedoucí</dt>
            <dd className="mt-0.5 text-slate-900">{leader.name}</dd>
          </div>
        )}
        {orgSynced && orgUnit && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Organizační složka</dt>
            <dd className="mt-0.5 text-slate-900">
              {orgUnit.designation}
              {orgUnit.name !== orgUnit.designation ? ` — ${orgUnit.name}` : ''}
            </dd>
          </div>
        )}
        {context.dataset && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dataset</dt>
            <dd className="mt-0.5 text-slate-900">
              {context.dataset.name}{' '}
              <span className="text-slate-500">
                ({datasetStatusLabel(context.dataset.status)})
              </span>
            </dd>
          </div>
        )}
        {record && context.column && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {context.column.name}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900">
              {formatHoverValue(record.values[context.column.key], context.column.type)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
