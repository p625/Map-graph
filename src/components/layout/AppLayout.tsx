import { Outlet } from 'react-router-dom'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
          <NotificationCenter />
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
