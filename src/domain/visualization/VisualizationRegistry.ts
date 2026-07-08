import type { VisualizationContext, VisualizationPlugin } from './types'
import { visualizationPlugins } from './plugins'

export class VisualizationRegistry {
  private readonly plugins = new Map<string, VisualizationPlugin>()

  constructor(plugins: VisualizationPlugin[] = visualizationPlugins) {
    for (const plugin of plugins) {
      this.plugins.set(plugin.id, plugin)
    }
  }

  register(plugin: VisualizationPlugin): void {
    this.plugins.set(plugin.id, plugin)
  }

  getAll(): VisualizationPlugin[] {
    return [...this.plugins.values()]
  }

  getById(id: string): VisualizationPlugin | undefined {
    return this.plugins.get(id)
  }

  getAvailable(context: Partial<VisualizationContext>): VisualizationPlugin[] {
    return this.getAll().filter((plugin) => {
      if (plugin.requiresDataset && !context.dataset) return false
      if (plugin.requiresColumn && !context.column) return false
      if (context.column && plugin.requiresColumn && !plugin.supportsColumn(context.column)) {
        return false
      }
      return true
    })
  }
}

export const visualizationRegistry = new VisualizationRegistry()
