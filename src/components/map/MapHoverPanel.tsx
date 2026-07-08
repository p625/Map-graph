import { districts } from '../../data/seed/districts'
import { datasetStatusLabel } from '../../domain/dataset/datasetValidation'
import { getRecordForDistrict } from '../../domain/visualization/contextUtils'
import { useConfigData } from '../../store/configStore'
import { useMapState } from '../../store/mapStore'
import { useActiveVisualization } from '../../hooks/useVisualization'

export function MapHoverPanel() {
  const { hoveredPolygon } = useMapState()
  const { workplaces, regionalOffices } = useConfigData()
  const { context } = useActiveVisualization()

  if (!hoveredPolygon) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
        Najetím na oblast zobrazíte detail okresu, pracoviště a dat.
      </div>
    )
  }

  const workplace = workplaces.find((item) => item.id === hoveredPolygon.workplaceId)
  const districtNames = hoveredPolygon.districtIds.map(
    (districtId) => districts.find((district) => district.id === districtId)?.name ?? districtId,
  )
  const representativeDistrictId = hoveredPolygon.districtIds[0] ?? null
  const record = representativeDistrictId
    ? getRecordForDistrict(context, representativeDistrictId)
    : null

  const regionalOfficeId = workplace
    ? context.workplaceRegionalAssignments[workplace.id]
    : null
  const regionalOffice = regionalOffices.find((item) => item.id === regionalOfficeId)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        {workplace?.name ?? districtNames[0] ?? 'Neznámá oblast'}
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
              {String(record.values[context.column.key] ?? '—')}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
