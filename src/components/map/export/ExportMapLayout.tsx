import { forwardRef } from 'react'
import { computeExportLayout } from '../../../domain/export/exportMapLayout'
import type { ExportMapSizing } from '../../../domain/export/exportMapLayout'
import type { LabelContentMode, LabelScope } from '../../../domain/labels/labelEngine'
import type { BoundaryVisibility } from '../../../domain/territory/types'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { RegionScope } from '../../../domain/region/types'
import type { RegionRenderMode } from '../../../domain/region/regionFocus'
import type { OrganizationLegendItem, OrganizationLegendSettings } from '../../../domain/organization/organizationLegend'
import { buildOrganizationLegendItems } from '../../../domain/organization/organizationLegend'
import type { DistrictColorMap, LegendSpec, VisualizationContext } from '../../../domain/visualization/types'
import { useMapRenderModel } from '../../../hooks/useMapRenderModel'
import { isOrganizationSynced, useOrganizationSnapshot } from '../../../store/organizationStore'
import { CzechMap } from '../CzechMap'
import { ExportMapLegend } from './ExportMapLegend'

export interface ExportMapLayoutProps {
  title: string
  subtitle: string
  colors: DistrictColorMap
  legend: LegendSpec
  width: number
  height: number
  showLegend: boolean
  showDatasetInfo: boolean
  showLabels: boolean
  labelScope: LabelScope
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
  showOrganizationLegend?: boolean
  organizationLegendSettings?: OrganizationLegendSettings
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
      showDatasetInfo,
      showLabels,
      labelScope,
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
      mapSizing,
      showOrganizationLegend = false,
      organizationLegendSettings,
    },
    ref,
  ) {
    const layout = computeExportLayout({
      width,
      height,
      showLegend,
      showDatasetInfo,
      title,
      subtitle,
      sizing: mapSizing,
    })

    const {
      padding,
      headerHeight,
      footerHeight,
      legendWidth,
      mapWidth,
      mapHeight,
      mapOnly,
    } = layout

    const titleSize = Math.round(width * 0.028)
    const subtitleSize = Math.round(width * 0.016)
    const footerSize = Math.round(width * 0.012)

    const { resolver, territories, fillStyles, boundaryLayers, labels, viewport } = useMapRenderModel({
      width: mapWidth,
      height: mapHeight,
      colors,
      strokeColor,
      boundaryVisibility,
      showLabels,
      labelScope,
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

    const orgLegendConfig: OrganizationLegendSettings | undefined =
      showOrganizationLegend && organizationLegendSettings
        ? { ...organizationLegendSettings, enabled: true }
        : undefined

    return (
      <div
        ref={ref}
        style={{
          width,
          height,
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {Boolean(title.trim() || subtitle.trim()) && (
          <div style={{ padding: `${padding}px ${padding}px 0`, minHeight: headerHeight }}>
            {title.trim() && (
              <h1
                style={{
                  margin: 0,
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: '#0f172a',
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                style={{
                  margin: `${Math.round(titleSize * 0.3)}px 0 0`,
                  fontSize: subtitleSize,
                  color: '#475569',
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            padding: mapOnly
              ? `${padding}px`
              : `${Math.round(padding * 0.5)}px ${padding}px`,
            gap: showLegend ? padding : 0,
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: mapWidth,
              height: mapHeight,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'stretch',
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <CzechMap
              territories={territories}
              fillStyles={fillStyles}
              boundaryLayers={boundaryLayers}
              labels={labels}
              organizationLegendItems={orgLegendItems}
              organizationLegendSettings={orgLegendConfig}
              resolver={resolver}
              interactive={false}
              width={mapWidth}
              height={mapHeight}
              viewport={viewport?.viewBox ?? null}
              className=""
            />
          </div>

          {showLegend && (
            <div
              style={{
                width: legendWidth,
                display: 'flex',
                flexDirection: 'column',
                gap: Math.round(padding * 0.6),
                borderLeft: '1px solid #e2e8f0',
                paddingLeft: padding,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <ExportMapLegend legend={legend} compact={width < 1600} />

              {showDatasetInfo && (
                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: Math.round(padding * 0.5),
                    fontSize: Math.max(11, Math.round(width * 0.011)),
                    color: '#475569',
                    lineHeight: 1.5,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Dataset</p>
                  {dataset ? (
                    <>
                      <p style={{ margin: '4px 0 0' }}>{dataset.name}</p>
                      {column && <p style={{ margin: '2px 0 0' }}>Sloupec: {column.name}</p>}
                      <p style={{ margin: '2px 0 0' }}>
                        Řádky: {dataset.matchedCount}/{dataset.recordCount}
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: '4px 0 0' }}>
                      {pluginName ?? 'Organizační vizualizace'}
                    </p>
                  )}
                  {themeName && <p style={{ margin: '2px 0 0' }}>Téma: {themeName}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {!mapOnly && footerHeight > 0 && (
          <div
            style={{
              padding: `0 ${padding}px ${padding}px`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: footerSize,
              color: '#64748b',
              minHeight: footerHeight,
            }}
          >
            <span>Vytvořeno: {createdAt.toLocaleDateString('cs-CZ')}</span>
            <span>Map Graph</span>
          </div>
        )}
      </div>
    )
  },
)
