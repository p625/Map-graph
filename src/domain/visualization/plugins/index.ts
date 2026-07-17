import type { VisualizationPlugin } from '../types'
import { byDistrictPlugin } from './byDistrictPlugin'
import { byLeaderPlugin } from './byLeaderPlugin'
import { byRegionalOfficePlugin } from './byRegionalOfficePlugin'
import { byWorkplacePlugin } from './byWorkplacePlugin'
import { categoricalPlugin } from './categoricalPlugin'
import { choroplethPlugin } from './choroplethPlugin'
import { neutralPlugin } from './neutralPlugin'

import { supervisionPlanPlugin } from './supervisionPlanPlugin'

export const visualizationPlugins: VisualizationPlugin[] = [
  neutralPlugin,
  byDistrictPlugin,
  byWorkplacePlugin,
  byRegionalOfficePlugin,
  byLeaderPlugin,
  supervisionPlanPlugin,
  choroplethPlugin,
  categoricalPlugin,
]

export {
  neutralPlugin,
  byDistrictPlugin,
  byWorkplacePlugin,
  byRegionalOfficePlugin,
  byLeaderPlugin,
  choroplethPlugin,
  categoricalPlugin,
  supervisionPlanPlugin,
}
