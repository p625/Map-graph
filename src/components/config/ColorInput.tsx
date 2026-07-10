import { isValidMapColor, normalizeHexColor } from '../../domain/color/mapColorValidation'

interface ColorInputProps {
  value: string
  onChange: (color: string) => void
  label?: string
}

export function ColorInput({ value, onChange, label }: ColorInputProps) {
  const displayValue = isValidMapColor(value) ? normalizeHexColor(value)! : value

  function handleHexChange(raw: string) {
    const normalized = normalizeHexColor(raw)
    if (normalized) onChange(normalized)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs font-medium text-slate-500">{label}</span>}
      <input
        type="color"
        value={isValidMapColor(displayValue) ? displayValue : '#94a3b8'}
        className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm"
        value={displayValue}
        placeholder="#1d4ed8"
        onChange={(event) => handleHexChange(event.target.value)}
      />
      <span
        className="inline-block h-8 w-8 rounded-md border border-slate-200"
        style={{ backgroundColor: isValidMapColor(displayValue) ? displayValue : '#f1f5f9' }}
        title="Náhled barvy"
      />
    </div>
  )
}
