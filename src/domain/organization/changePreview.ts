export interface FieldChange<T> {
  before: T
  after: T
  changedFields: string[]
}

export interface ChangeSet<T> {
  new: T[]
  changed: FieldChange<T>[]
  removed: T[]
  conflicting: Array<{
    local: T
    incoming: T
    reason: string
  }>
}

export interface DistrictAssignmentChange {
  districtId: string
  districtName: string
  beforeWorkplaceId: string | null
  afterWorkplaceId: string | null
  beforeWorkplaceName?: string
  afterWorkplaceName?: string
}

export interface OrganizationChangePreview {
  regions: ChangeSet<{ id: string; name: string }>
  orgUnits: ChangeSet<{ id: string; designation: string; name: string }>
  leaders: ChangeSet<{ id: string; name: string; color: string }>
  workplaces: ChangeSet<{ id: string; name: string }>
  districtAssignments: ChangeSet<DistrictAssignmentChange>
}

export function emptyChangeSet<T>(): ChangeSet<T> {
  return { new: [], changed: [], removed: [], conflicting: [] }
}

export function countChanges<T>(set: ChangeSet<T>): number {
  return set.new.length + set.changed.length + set.removed.length + set.conflicting.length
}

export function totalChanges(preview: OrganizationChangePreview): number {
  return (
    countChanges(preview.regions) +
    countChanges(preview.orgUnits) +
    countChanges(preview.leaders) +
    countChanges(preview.workplaces) +
    countChanges(preview.districtAssignments)
  )
}
