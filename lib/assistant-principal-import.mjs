export const SETUP_HEADERS = ['type', 'name', 'role', 'email', 'applies_to', 'cadence', 'due_day', 'due_time']
const roles = new Set(['teacher', 'office', 'support', 'leader', 'other'])
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function readCsv(text) {
  if (typeof text !== 'string' || text.length > 524288) throw new Error('Choose a CSV smaller than 512 KB.')
  const rows = []
  let row = [], cell = '', quoted = false, afterQuote = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') { quoted = false; afterQuote = true }
      else cell += ch
    } else if (afterQuote) {
      if (ch === ',') { row.push(cell); cell = ''; afterQuote = false }
      else if (ch === '\n' || ch === '\r') {
        row.push(cell); rows.push(row); row = []; cell = ''; afterQuote = false
        if (ch === '\r' && text[i + 1] === '\n') i++
      } else if (ch !== ' ' && ch !== '\t') throw new Error(`Unexpected character after a quoted cell near row ${rows.length + 1}.`)
    } else if (ch === '"') {
      if (cell.trim()) throw new Error(`Unexpected quote near row ${rows.length + 1}.`)
      cell = ''; quoted = true
    } else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      row.push(cell); rows.push(row); row = []; cell = ''
      if (ch === '\r' && text[i + 1] === '\n') i++
    } else cell += ch
  }
  if (quoted) throw new Error('A quoted CSV cell is not closed.')
  if (cell || row.length || afterQuote) { row.push(cell); rows.push(row) }
  return rows.filter(row => row.some(cell => cell.trim()))
}

export function parseSetupCsv(text) {
  const [header, ...lines] = readCsv(text)
  if (!header) throw new Error('The CSV is empty.')
  const labels = header.map(cell => cell.trim().toLowerCase())
  if (labels.length !== SETUP_HEADERS.length || new Set(labels).size !== SETUP_HEADERS.length || !SETUP_HEADERS.every(h => labels.includes(h))) {
    throw new Error(`Use the template headings: ${SETUP_HEADERS.join(', ')}.`)
  }
  if (!lines.length) throw new Error('Add at least one staff or commitment row.')
  if (lines.length > 500) throw new Error('Import at most 500 rows at once.')
  const staff = [], commitments = [], errors = [], seen = new Set()
  lines.forEach((cells, i) => {
    const rowNumber = i + 2
    if (cells.length !== labels.length) { errors.push(`Row ${rowNumber}: expected ${labels.length} columns.`); return }
    const value = Object.fromEntries(labels.map((label, index) => [label, cells[index].trim()]))
    const type = value.type.toLowerCase()
    if (type === 'staff') {
      const role = value.role.toLowerCase()
      if (value.name.length < 2 || value.name.length > 120 || !roles.has(role) || (value.email && (value.email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email)))) {
        errors.push(`Row ${rowNumber}: enter a staff name, valid role, and optional email.`); return
      }
      const key = `staff:${value.name.toLowerCase()}:${role}`
      if (seen.has(key)) { errors.push(`Row ${rowNumber}: duplicate staff name and role in this file.`); return }
      seen.add(key)
      staff.push({ display_name: value.name, role, email: value.email.toLowerCase() || null })
    } else if (type === 'commitment') {
      const cadence = value.cadence.toLowerCase(), appliesTo = value.applies_to.toLowerCase()
      const day = days.indexOf(value.due_day.toLowerCase())
      if (value.name.length < 2 || value.name.length > 120 || !['all', 'teachers'].includes(appliesTo) || !['daily', 'weekly'].includes(cadence) || (cadence === 'weekly' ? day < 0 : !!value.due_day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.due_time)) {
        errors.push(`Row ${rowNumber}: enter a commitment name, applies_to, cadence, due_day, and 24-hour due_time.`); return
      }
      const key = `commitment:${value.name.toLowerCase()}:${appliesTo}:${cadence}:${day}:${value.due_time}`
      if (seen.has(key)) { errors.push(`Row ${rowNumber}: duplicate commitment in this file.`); return }
      seen.add(key)
      commitments.push({ title: value.name, applies_to: appliesTo, cadence, due_weekday: cadence === 'weekly' ? day : null, due_time: value.due_time })
    } else errors.push(`Row ${rowNumber}: type must be staff or commitment.`)
  })
  if (commitments.length > 100) errors.push('Import at most 100 commitments at once.')
  return { staff, commitments, errors, total: lines.length }
}
