import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/cn'

const links = [
  { to: '/dashboard', label: 'Přehled projektu' },
  { to: '/map', label: 'Mapa' },
  { to: '/supervision-plan', label: 'Plán supervizí' },
  { to: '/datasets', label: 'Datasety' },
  { to: '/datasets/wizard', label: 'Import wizard' },
  { to: '/config/districts', label: 'Okresy → Pracoviště' },
  { to: '/config/district-colors', label: 'Barvy okresů' },
  { to: '/config/workplace-colors', label: 'Barvy pracovišť' },
  { to: '/config/regional-colors', label: 'Barvy regionů' },
  { to: '/config/regional', label: 'Pracoviště → Regiony' },
  { to: '/config/leaders', label: 'Pracoviště → Vedoucí' },
  { to: '/organization/sync', label: 'Synchronizace organizace' },
  { to: '/settings/workspace', label: 'Záloha a data' },
]

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Map Graph</p>
        <h1 className="text-lg font-semibold text-slate-900">Analytická mapová platforma</h1>
      </div>
      <nav className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
