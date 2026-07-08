/**
 * Workspace — architektonická příprava pro budoucí více kontextů (LPIS, Dotace, …).
 * V Production Ready se neimplementuje runtime vrstva, pouze typy.
 */
export interface Workspace {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  configId: string
  activeDatasetId: string | null
  visualizationThemeId: string
}

export interface WorkspaceContext {
  workspace: Workspace
  configuration: unknown
  datasets: unknown[]
  visualizations: unknown
}
