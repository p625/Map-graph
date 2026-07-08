declare module 'react-simple-maps' {
  import type { ReactNode } from 'react'

  export interface Geography {
    rsmKey: string
    id?: string
    properties?: Record<string, unknown>
  }

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: Record<string, number | [number, number]>
    width?: number
    height?: number
    style?: React.CSSProperties
    children?: ReactNode
  }

  export interface GeographyProps {
    geography: Geography | Record<string, unknown>
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: Record<string, React.CSSProperties>
    onMouseEnter?: () => void
    onMouseLeave?: () => void
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: {
    geography: unknown
    children: (args: { geographies: Geography[] }) => ReactNode
  }): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
}
