import { forwardRef } from 'react'
import type { ExportCompositionLayout, ExportCompositionSelection } from '../../../domain/export/exportCompositionLayout'
import type { ExportMapSizing } from '../../../domain/export/exportMapLayout'
import type { LabelContentMode } from '../../../domain/labels/labelEngine'
import type { MapLabelFontSizes, MapLabelVisibility } from '../../../domain/labels/labelSettings'
import type { BoundaryVisibility } from '../../../domain/territory/types'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { RegionScope } from '../../../domain/region/types'
import type { RegionRenderMode } from '../../../domain/region/regionFocus'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../../domain/organization/organizationLegend'
import { buildOrganizationLegendItems } from '../../../domain/organization/organizationLegend'
import { applyEditorLegendToComposition } from '../../../domain/export/exportCompositionLayout'
import { extractOrganizationalLegendRatioLayout } from '../../../domain/organization/exportOrganizationLegendLayout'
import type { DistrictColorMap, LegendSpec, VisualizationContext } from '../../../domain/visualization/types'
import { MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from '../../../domain/map/mapViewport'
import { useMapRenderModel } from '../../../hooks/useMapRenderModel'
import { isOrganizationSynced, useOrganizationSnapshot } from '../../../store/organizationStore'
import { ExportCompositionCanvas } from './ExportCompositionCanvas'

export interface ExportMapLayoutProps {
  title: string
  subtitle: string
  colors: DistrictColorMap
  legend: LegendSpec
  width: number
  height: number
  showLegend: boolean
  showOrganizationLegend?: boolean
  showDatasetInfo: boolean
  showLabels: boolean
  labelVisibility?: MapLabelVisibility
  labelFontSizes?: MapLabelFontSizes
  labelContentMode?: LabelContentMode
  boundaryVisibility: BoundaryVisibility
  context?: VisualizationContext
  dataset?: Dataset
  column?: DatasetColumn
  pluginName?: string
  themeName?: string
  createdAt?: Date
  strokeColor?: string
  regionScope?: RegionScope
  regionRenderMode?: RegionRenderMode
  mapSizing?: ExportMapSizing
  organizationLegendSettings?: OrganizationLegendSettings
  composition: ExportCompositionLayout
  compositionInteractive?: boolean
  compositionPreviewScale?: number
  selectedCompositionElement?: ExportCompositionSelection
  onSelectCompositionElement?: (selection: ExportCompositionSelection) => void
  onCompositionChange?: (composition: ExportCompositionLayout) => void
}

export const ExportMapLayout = forwardRef<HTMLDivElement, ExportMapLayoutProps>(
  function ExportMapLayout(
    {
      title,
      subtitle,
      colors,
      legend,
      width,
      height,
      showLegend,
      showOrganizationLegend = false,
      showDatasetInfo,
      showLabels,
      labelVisibility,
      labelFontSizes,
      labelContentMode = 'name',
      boundaryVisibility,
      context,
      dataset,
      column,
      pluginName,
      themeName,
      createdAt = new Date(),
      strokeColor,
      regionScope,
      regionRenderMode = 'export-country',
      organizationLegendSettings,
      composition,
      compositionInteractive = false,
      compositionPreviewScale = 1,
      selectedCompositionElement = null,
      onSelectCompositionElement,
      onCompositionChange,
    },
    ref,
  ) {
    const { resolver, territories, fillStyles, boundaryLayers, labels, viewport } = useMapRenderModel({
      width: MAP_LOGICAL_WIDTH,
      height: MAP_LOGICAL_HEIGHT,
      colors,
      strokeColor,
      boundaryVisibility,
      showLabels,
      labelVisibility,
      labelFontSizes,
      labelContentMode,
      context,
      regionScope,
      regionRenderMode,
    })

    const snapshot = useOrganizationSnapshot()
    const orgLegendItems: OrganizationLegendItem[] =
      showOrganizationLegend &&
      organizationLegendSettings &&
      isOrganizationSynced(snapshot)
        ? buildOrganizationLegendItems({
            leaders: snapshot.leaders,
            orgUnits: snapshot.orgUnits,
            workplaces: snapshot.workplaces,
            regionScope,
            maxItems: organizationLegendSettings.maxItems,
          })
        : []

    const effectiveComposition =
      composition.organizationalLegend.inheritPositionFromEditor &&
      organizationLegendSettings
        ? applyEditorLegendToComposition(
            composition,
            extractOrganizationalLegendRatioLayout(organizationLegendSettings.layout),
          )
        : {
            ...composition,
            title: { ...composition.title, text: composition.title.text || title },
            organizationalLegend: {
              ...composition.organizationalLegend,
              visible: showOrganizationLegend && composition.organizationalLegend.visible,
            },
          }

    return (
      <div ref={ref}>
        <ExportCompositionCanvas
          canvasWidth={width}
          canvasHeight={height}
          previewScale={compositionPreviewScale}
          composition={effectiveComposition}
          interactive={compositionInteractive}
          selectedElement={selectedCompositionElement}
          onSelectElement={onSelectCompositionElement}
          onCompositionChange={onCompositionChange}
          titleText={title}
          subtitleText={subtitle}
          showDataLegend={showLegend}
          showDatasetInfo={showDatasetInfo}
          dataLegend={legend}
          dataset={dataset}
          column={column}
          pluginName={pluginName}
          themeName={themeName}
          createdAt={createdAt}
          orgLegendItems={orgLegendItems}
          orgLegendSettings={
            showOrganizationLegend && organizationLegendSettings
              ? { ...organizationLegendSettings, enabled: true }
              : undefined
          }
          territories={territories}
          fillStyles={fillStyles}
          boundaryLayers={boundaryLayers}
          labels={labels}
          resolver={resolver}
          viewport={viewport?.viewBox ?? null}
          mapRenderWidth={MAP_LOGICAL_WIDTH}
          mapRenderHeight={MAP_LOGICAL_HEIGHT}
        />
      </div>
    )
  },
)
