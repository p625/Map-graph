import { useState } from 'react'
import { useNotifications } from '../../store/notificationStore'
import { cn } from '../../utils/cn'

const typeStyles = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

export function NotificationCenter() {
  const { items, unreadCount, markRead, markAllRead, clear } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
      >
        Oznámení
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Centrum oznámení</h3>
            <div className="flex gap-2">
              {items.length > 0 && (
                <>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={markAllRead}
                  >
                    Označit vše
                  </button>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:underline"
                    onClick={clear}
                  >
                    Vymazat
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Žádná oznámení</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'w-full border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                    !item.read && 'bg-blue-50/50',
                  )}
                  onClick={() => markRead(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.title}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                        typeStyles[item.type],
                      )}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString('cs-CZ')}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
