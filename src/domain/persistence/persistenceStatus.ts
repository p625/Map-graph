export type PersistenceMode = 'local' | 'cloud'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const PERSISTENCE_MODE: PersistenceMode = 'local'

export function persistenceModeLabel(mode: PersistenceMode = PERSISTENCE_MODE): string {
  return mode === 'local' ? 'Lokální úložiště prohlížeče' : 'Cloud'
}

export function crossDeviceSyncLabel(mode: PersistenceMode = PERSISTENCE_MODE): string {
  return mode === 'local' ? 'Ne' : 'Ano'
}

export function savedStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Ukládám…'
    case 'saved':
      return 'Uloženo lokálně'
    case 'error':
      return 'Chyba uložení'
    default:
      return '—'
  }
}
