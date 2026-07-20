/**
 * Minimal RFC-4180-ish CSV parser — no external dependency needed for the
 * handful of columns a CRM import needs. Handles quoted fields, commas and
 * newlines inside quotes, and escaped quotes ("").
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalize line endings so \r\n inside/outside quotes behaves the same
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const char = src[i]
    const next  = src[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++ }
      else if (char === '"') { inQuotes = false }
      else { field += char }
      continue
    }

    if (char === '"') { inQuotes = true }
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  // Trailing field/row (files don't always end with a newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

/**
 * Parses CSV text into an array of objects keyed by the header row.
 * Header matching is case-insensitive and ignores surrounding whitespace,
 * so "Email", " email ", and "EMAIL" all map to the same key.
 */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  const headers = rows[0].map(h => h.trim().toLowerCase())
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((header, i) => { obj[header] = (row[i] ?? '').trim() })
    return obj
  })
}
