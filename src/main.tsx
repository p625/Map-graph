import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ConfigProvider } from './store/configStore.tsx'
import { DatasetProvider } from './store/datasetStore.tsx'
import { MapProvider } from './store/mapStore.tsx'
import { NotificationProvider } from './store/notificationStore.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <ConfigProvider>
          <DatasetProvider>
            <MapProvider>
              <App />
            </MapProvider>
          </DatasetProvider>
        </ConfigProvider>
      </NotificationProvider>
    </BrowserRouter>
  </StrictMode>,
)
