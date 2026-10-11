/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Rows → RFC 4180 CSV (CRLF, quoted when needed), with a BOM so Excel reads
 * UTF-8. Cells that a spreadsheet would run as a formula are prefixed with '.
 */
export function toCsv(rows: (string | null | undefined)[][]): string {
  const cell = (v: string | null | undefined) => {
    const raw = v ?? ''
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}
