import { Link } from 'react-router-dom'
import { computeDatasetHealth, summarizeColumns } from '../domain/dataset/datasetHealth'
import { datasetStatusLabel } from '../domain/dataset/datasetValidation'
import { useConfigData, useConfigState } from '../store/configStore'
import { useDatasetState } from '../store/datasetStore'

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function ProjectDashboardPage() {
  const { districts, workplaces, regionalOffices } = useConfigData()
  const { districtWorkplaceAssignments, workplaceRegionalAssignments } = useConfigState()
  const { datasets } = useDatasetState()

  const assignedDistricts = Object.keys(districtWorkplaceAssignments).length
  const assignedWorkplaces = Object.keys(workplaceRegionalAssignments).length
  const readyDatasets = datasets.filter((d) => d.status === 'ready').length
  const totalRecords = datasets.reduce((sum, d) => sum + d.recordCount, 0)

  const latestDataset = datasets[0]
  const health = latestDataset ? computeDatasetHealth(latestDataset) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Přehled projektu</h2>
        <p className="mt-1 text-sm text-slate-600">
          Základní statistiky konfigurace, datasetů a připravenosti mapy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Okresy" value={districts.length} hint={`${assignedDistricts} přiřazeno`} />
        <StatCard label="Pracoviště OPŽL" value={workplaces.length} />
        <StatCard
          label="Regionální odbory"
          value={regionalOffices.length}
          hint={`${assignedWorkplaces} pracovišť přiřazeno`}
        />
        <StatCard
          label="Datasety"
          value={datasets.length}
          hint={`${readyDatasets} připravených`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Data</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Celkem řádků</dt>
              <dd className="font-medium text-slate-900">{totalRecords}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Připravené datasety</dt>
              <dd className="font-medium text-slate-900">{readyDatasets}</dd>
            </div>
            {latestDataset && (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Poslední dataset</dt>
                  <dd className="font-medium text-slate-900">{latestDataset.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Stav</dt>
                  <dd className="font-medium text-slate-900">
                    {datasetStatusLabel(latestDataset.status)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Sloupce</dt>
                  <dd className="font-medium text-slate-900">
                    {summarizeColumns(latestDataset.columns)}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <div className="mt-4 flex gap-2">
            <Link
              to="/datasets"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Správa datasetů
            </Link>
            <Link
              to="/datasets/wizard"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Nový import
            </Link>
          </div>
        </div>

        {health && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Zdraví posledního datasetu</h3>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold"
                style={{
                  backgroundColor:
                    health.overallScore >= 80
                      ? '#dcfce7'
                      : health.overallScore >= 50
                        ? '#fef3c7'
                        : '#fee2e2',
                  color:
                    health.overallScore >= 80
                      ? '#166534'
                      : health.overallScore >= 50
                        ? '#92400e'
                        : '#991b1b',
                }}
              >
                {health.overallScore}%
              </div>
              <div className="text-sm text-slate-600">
                <p>
                  Spárováno: {health.rowsMatched}/{health.rowsTotal}
                </p>
                <p>
                  Sloupce: {health.numericColumns} číselné, {health.textColumns} textové
                </p>
              </div>
            </div>
            {health.issues.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {health.issues.map((issue) => (
                  <li
                    key={issue.code}
                    className={
                      issue.severity === 'error'
                        ? 'text-red-700'
                        : issue.severity === 'warning'
                          ? 'text-amber-700'
                          : 'text-slate-600'
                    }
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
