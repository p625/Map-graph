import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ConfigProvider } from './store/configStore.tsx'
import { AssignmentConfigBridge } from './components/config/AssignmentConfigBridge.tsx'
import { DatasetProvider } from './store/datasetStore.tsx'
import { MapProvider } from './store/mapStore.tsx'
import { RegionLabelOverridesProvider } from './store/regionLabelOverridesStore.tsx'
import { WorkplaceLabelOverridesProvider } from './store/workplaceLabelOverridesStore.tsx'
import { NotificationProvider } from './store/notificationStore.tsx'
import { OrganizationProvider } from './store/organizationStore.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <OrganizationProvider>
          <ConfigProvider>
            <AssignmentConfigBridge />
            <DatasetProvider>
              <MapProvider>
                <RegionLabelOverridesProvider>
                  <WorkplaceLabelOverridesProvider>
                    <App />
                  </WorkplaceLabelOverridesProvider>
                </RegionLabelOverridesProvider>
              </MapProvider>
            </DatasetProvider>
          </ConfigProvider>
        </OrganizationProvider>
      </NotificationProvider>
    </BrowserRouter>
  </StrictMode>,
)
