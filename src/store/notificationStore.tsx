import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { loadJson, saveJson } from '../utils/storage'

export type NotificationType = 'success' | 'warning' | 'error' | 'info'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
}

interface NotificationState {
  items: AppNotification[]
}

type NotificationAction =
  | { type: 'add'; notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> }
  | { type: 'mark-read'; id: string }
  | { type: 'mark-all-read' }
  | { type: 'clear' }

const STORAGE_KEY = 'map-graph-notifications-v1'
const MAX_NOTIFICATIONS = 50

function loadInitial(): NotificationState {
  return loadJson<NotificationState>(STORAGE_KEY, { items: [] })
}

function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case 'add': {
      const item: AppNotification = {
        ...action.notification,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        read: false,
      }
      return { items: [item, ...state.items].slice(0, MAX_NOTIFICATIONS) }
    }
    case 'mark-read':
      return {
        items: state.items.map((n) =>
          n.id === action.id ? { ...n, read: true } : n,
        ),
      }
    case 'mark-all-read':
      return { items: state.items.map((n) => ({ ...n, read: true })) }
    case 'clear':
      return { items: [] }
    default:
      return state
  }
}

const StateContext = createContext<NotificationState | null>(null)
const DispatchContext = createContext<Dispatch<NotificationAction> | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, undefined, loadInitial)

  useEffect(() => {
    saveJson(STORAGE_KEY, state)
  }, [state])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useNotifications() {
  const state = useContext(StateContext)
  const dispatch = useContext(DispatchContext)
  if (!state || !dispatch) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }

  const notify = useCallback(
    (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
      dispatch({ type: 'add', notification })
    },
    [dispatch],
  )

  const unreadCount = state.items.filter((n) => !n.read).length

  return {
    items: state.items,
    unreadCount,
    notify,
    markRead: (id: string) => dispatch({ type: 'mark-read', id }),
    markAllRead: () => dispatch({ type: 'mark-all-read' }),
    clear: () => dispatch({ type: 'clear' }),
  }
}
