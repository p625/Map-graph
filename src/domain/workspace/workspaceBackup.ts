import { loadJson, saveJson } from '../../utils/storage'
import { REGION_LABEL_OVERRIDES_KEY } from '../labels/regionLabelOverrides'
import { WORKPLACE_LABEL_OVERRIDES_KEY } from '../labels/workplaceLabelOverrides'
import { CUSTOM_COLOR_THEMES_STORAGE_KEY } from '../color-themes/types'
import { SUPERVISION_PLAN_STORAGE_KEY } from '../supervision-plan/types'

export const WORKSPACE_BACKUP_VERSION = 1

export const WORKSPACE_MODULE_KEYS = {
  organization: 'map-graph-org-v1',
  config: 'map-graph-config-v4',
  datasets: 'map-graph-datasets-v2',
  map: 'map-graph-map-v3',
  workplaceLabelOverrides: WORKPLACE_LABEL_OVERRIDES_KEY,
  regionLabelOverrides: REGION_LABEL_OVERRIDES_KEY,
  supervisionPlan: SUPERVISION_PLAN_STORAGE_KEY,
  customColorThemes: CUSTOM_COLOR_THEMES_STORAGE_KEY,
  templates: 'map-graph-templates-v1',
  exportPresets: 'map-graph-export-presets-v1',
} as const

export type WorkspaceModuleKey = keyof typeof WORKSPACE_MODULE_KEYS

export interface WorkspaceBackup {
  version: number
  exportedAt: string
  modules: Partial<Record<WorkspaceModuleKey, unknown>>
}

export interface WorkspaceBackupSummary {
  organizationSynced: boolean
  datasetCount: number
  hasMapSettings: boolean
  hasTemplates: boolean
}

export interface WorkspaceRestoreValidation {
  ok: boolean
  version: number | null
  summary: WorkspaceBackupSummary | null
  errors: string[]
}

function readModule(key: WorkspaceModuleKey): unknown {
  const storageKey = WORKSPACE_MODULE_KEYS[key]
  if (key === 'templates') {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  return loadJson(storageKey, null)
}

export function exportWorkspaceBackup(): WorkspaceBackup {
  const modules: Partial<Record<WorkspaceModuleKey, unknown>> = {}
  for (const key of Object.keys(WORKSPACE_MODULE_KEYS) as WorkspaceModuleKey[]) {
    const value = readModule(key)
    if (value !== null && value !== undefined) {
      modules[key] = value
    }
  }
  return {
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    modules,
  }
}

export function serializeWorkspaceBackup(): string {
  return JSON.stringify(exportWorkspaceBackup(), null, 2)
}

function summarizeBackup(backup: WorkspaceBackup): WorkspaceBackupSummary {
  const org = backup.modules.organization as { regions?: unknown[]; syncedAt?: string } | undefined
  const datasets = backup.modules.datasets as { datasets?: unknown[] } | undefined
  return {
    organizationSynced: Boolean(org?.regions?.length && org?.syncedAt),
    datasetCount: Array.isArray(datasets?.datasets) ? datasets!.datasets!.length : 0,
    hasMapSettings: backup.modules.map !== undefined,
    hasTemplates: backup.modules.templates !== undefined,
  }
}

export function validateWorkspaceBackup(raw: unknown): WorkspaceRestoreValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') {
    return { ok: false, version: null, summary: null, errors: ['Soubor není platný JSON objekt.'] }
  }
  const backup = raw as WorkspaceBackup
  if (typeof backup.version !== 'number') {
    errors.push('Chybí verze zálohy.')
  } else if (backup.version !== WORKSPACE_BACKUP_VERSION) {
    errors.push(`Nepodporovaná verze zálohy: ${backup.version}.`)
  }
  if (!backup.modules || typeof backup.modules !== 'object') {
    errors.push('Chybí sekce modules.')
  }
  return {
    ok: errors.length === 0,
    version: typeof backup.version === 'number' ? backup.version : null,
    summary: errors.length === 0 ? summarizeBackup(backup) : null,
    errors,
  }
}

export function restoreWorkspaceBackup(backup: WorkspaceBackup): string[] {
  const failures: string[] = []
  for (const key of Object.keys(WORKSPACE_MODULE_KEYS) as WorkspaceModuleKey[]) {
    const value = backup.modules[key]
    if (value === undefined) continue
    const storageKey = WORKSPACE_MODULE_KEYS[key]
    const result = saveJson(storageKey, value)
    if (!result.ok) {
      failures.push(`${key}: ${result.error ?? 'unknown'}`)
    }
  }
  return failures
}

export function clearWorkspaceModule(key: WorkspaceModuleKey): void {
  localStorage.removeItem(WORKSPACE_MODULE_KEYS[key])
}

export function estimateWorkspaceSizeBytes(): number {
  const backup = exportWorkspaceBackup()
  return JSON.stringify(backup).length
}
