import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ConfigDistrictAssignmentsPage } from './pages/ConfigDistrictAssignmentsPage'
import { ConfigRegionalAssignmentsPage } from './pages/ConfigRegionalAssignmentsPage'
import { DatasetListPage } from './pages/DatasetListPage'
import { DatasetWizardPage } from './pages/DatasetWizardPage'
import { MapPage } from './pages/MapPage'
import { ProjectDashboardPage } from './pages/ProjectDashboardPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/datasets" element={<DatasetListPage />} />
        <Route path="/datasets/wizard" element={<DatasetWizardPage />} />
        <Route path="/datasets/import" element={<Navigate to="/datasets/wizard" replace />} />
        <Route path="/datasets/manual" element={<Navigate to="/datasets/wizard" replace />} />
        <Route path="/config/districts" element={<ConfigDistrictAssignmentsPage />} />
        <Route path="/config/regional" element={<ConfigRegionalAssignmentsPage />} />
      </Route>
    </Routes>
  )
}
