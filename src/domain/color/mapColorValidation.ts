const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

const WHITE_HEX = new Set(['#fff', '#ffffff'])

function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return hex
}

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!HEX_COLOR_RE.test(withHash)) return null
  return expandShortHex(withHash.toLowerCase())
}

export function isValidMapColor(input: string | null | undefined): input is string {
  if (!input) return false
  const normalized = normalizeHexColor(input)
  if (!normalized) return false
  if (WHITE_HEX.has(normalized)) return false
  return true
}

/** Vrátí platnou barvu nebo null (pro zápis do store). */
export function sanitizeMapColor(input: string): string | null {
  return isValidMapColor(input) ? normalizeHexColor(input)! : null
}

export function resolveMapColor(
  preferred: string | null | undefined,
  fallback: string,
): string {
  if (isValidMapColor(preferred)) return normalizeHexColor(preferred)!
  if (isValidMapColor(fallback)) return normalizeHexColor(fallback)!
  return '#94a3b8'
}
