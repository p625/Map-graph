import { forwardRef } from 'react'
import type { Dataset } from '../../../domain/types/dataset'
import type { DatasetColumn } from '../../../domain/types/datasetColumn'
import type { DistrictColorMap, LegendSpec } from '../../../domain/visualization/types'
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
  dataset?: Dataset
  column?: DatasetColumn
  pluginName?: string
  themeName?: string
  createdAt?: Date
  strokeColor?: string
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
      dataset,
      column,
      pluginName,
      themeName,
      createdAt = new Date(),
      strokeColor,
    },
    ref,
  ) {
    const padding = Math.round(width * 0.04)
    const headerHeight = Math.round(height * 0.12)
    const footerHeight = Math.round(height * 0.06)
    const contentHeight = height - headerHeight - footerHeight - padding * 2
    const legendWidth = showLegend ? Math.round(width * 0.22) : 0
    const mapWidth = width - padding * 2 - legendWidth - (showLegend ? padding : 0)
    const mapHeight = contentHeight

    const mapRenderWidth = Math.round(mapWidth * 0.95)
    const mapRenderHeight = Math.round(mapHeight * 0.95)

    const titleSize = Math.round(width * 0.028)
    const subtitleSize = Math.round(width * 0.016)
    const footerSize = Math.round(width * 0.012)

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
        <div style={{ padding: `${padding}px ${padding}px 0`, minHeight: headerHeight }}>
          <h1
            style={{
              margin: 0,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.2,
              color: '#0f172a',
            }}
          >
            {title || 'Mapový graf'}
          </h1>
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

        <div
          style={{
            flex: 1,
            display: 'flex',
            padding: `${Math.round(padding * 0.5)}px ${padding}px`,
            gap: padding,
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
            }}
          >
            <CzechMap
              colors={colors}
              interactive={false}
              width={mapRenderWidth}
              height={mapRenderHeight}
              className=""
              strokeColor={strokeColor}
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
      </div>
    )
  },
)
