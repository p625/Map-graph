import type { LabelContentMode } from './labelEngine'

export function splitDisplayName(name: string): string[] {
  return name.split('\n').filter((line) => line.length > 0)
}

export function composeLabelText(
  nameLines: string[],
  valueText: string | null | undefined,
  contentMode: LabelContentMode,
): string {
  const name = nameLines.join('\n')
  if (contentMode === 'supervision-year') {
    return valueText ?? name
  }
  if (contentMode === 'supervision-name-year' && valueText) {
    return name ? `${name}\n${valueText}` : valueText
  }
  if (contentMode === 'value') {
    return valueText ?? name
  }
  if (contentMode === 'name-value' && valueText) {
    return name ? `${name}\n${valueText}` : valueText
  }
  return name
}

export function resolveSupervisionYearText(
  contentMode: LabelContentMode,
  year: number | null,
): string | null {
  if (contentMode !== 'supervision-year' && contentMode !== 'supervision-name-year') return null
  return year === null ? null : String(year)
}

export function resolveLabelNameLines(
  displayTextOverride: string | undefined,
  defaultName: string,
): string[] {
  if (displayTextOverride) {
    return displayTextOverride.split('\n').filter((line) => line.length > 0)
  }
  return splitDisplayName(defaultName)
}

export function resolveWorkplaceValueText(
  contentMode: LabelContentMode,
  datasetValue: string | null,
): string | null {
  if (contentMode === 'name') return null
  return datasetValue
}
