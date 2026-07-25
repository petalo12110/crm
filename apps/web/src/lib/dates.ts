/**
 * Converts a datetime-local input value ("2026-07-02T10:00")
 * to a full ISO string the API accepts ("2026-07-02T10:00:00.000Z")
 */
export function localInputToISO(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  // Already has timezone info
  if (value.includes('Z') || value.includes('+')) return value
  // Append seconds and Z
  const withSeconds = value.length === 16 ? `${value}:00` : value
  return new Date(withSeconds).toISOString()
}

/**
 * Converts an ISO string to a datetime-local input value
 */
export function isoToLocalInput(iso: string | undefined | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    // Format: YYYY-MM-DDTHH:MM
    return d.toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

/**
 * Converts a date input value ("2026-07-02") to ISO date string
 */
export function dateInputToISO(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  return value  // date-only values are fine as-is
}
