import type { VisualizationPlugin } from '../types'
import { byRegionalOfficePlugin } from './byRegionalOfficePlugin'
import { byWorkplacePlugin } from './byWorkplacePlugin'
import { categoricalPlugin } from './categoricalPlugin'
import { choroplethPlugin } from './choroplethPlugin'
import { neutralPlugin } from './neutralPlugin'

export const visualizationPlugins: VisualizationPlugin[] = [
  neutralPlugin,
  byWorkplacePlugin,
  byRegionalOfficePlugin,
  choroplethPlugin,
  categoricalPlugin,
]

export {
  neutralPlugin,
  byWorkplacePlugin,
  byRegionalOfficePlugin,
  choroplethPlugin,
  categoricalPlugin,
}
