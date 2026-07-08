export type ColumnType = 'number' | 'text' | 'percent'

export interface DatasetColumn {
  id: string
  key: string
  name: string
  type: ColumnType
  nullable: boolean
}
