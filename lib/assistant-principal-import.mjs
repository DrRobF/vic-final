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

function table(text, expected) {
  const [header, ...lines] = readCsv(text)
  if (!header) throw new Error('The CSV is empty.')
  const labels = header.map(cell => cell.trim().toLowerCase())
  const choices = Array.isArray(expected[0]) ? expected : [expected]
  if (!choices.some(choice => labels.length === choice.length && choice.every((label, index) => labels[index] === label))) {
    throw new Error(`Use the downloaded template with these headings: ${choices[0].join(', ')}.`)
  }
  if (!lines.length) throw new Error('Add at least one row below the headings.')
  if (lines.length > 500) throw new Error('Import at most 500 rows at once.')
  return { lines, labels }
}

export function parseStaffCsv(text) {
  const { lines, labels } = table(text, [
    ['staff name', 'role', 'grade or assignment (optional)', 'email (optional)'],
    ['staff name', 'role', 'email (optional)'],
  ])
  const staff = [], errors = [], seen = new Set()
  lines.forEach((cells, i) => {
    const rowNumber = i + 2
    if (cells[0]?.trim().toUpperCase().startsWith('EXAMPLE:')) return
    if (cells.length !== labels.length) { errors.push(`Row ${rowNumber}: expected ${labels.length} columns.`); return }
    const [name, rawRole, assignment, rawEmail] = labels.length === 4 ? cells.map(cell => cell.trim()) : [cells[0].trim(), cells[1].trim(), '', cells[2].trim()]
    const role = rawRole.toLowerCase(), email = rawEmail.toLowerCase()
    if (name.length < 2 || name.length > 120 || !roles.has(role) || assignment.length > 120 || (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))) {
      errors.push(`Row ${rowNumber}: use Teacher, Office, Support, Leader, or Other as the role. Put a grade level in Grade or assignment.`); return
    }
    const key = `${name.toLowerCase()}:${role}`
    if (seen.has(key)) { errors.push(`Row ${rowNumber}: duplicate name and role in this file.`); return }
    seen.add(key)
    staff.push({ display_name: name, role, assignment, email: email || null })
  })
  if (!staff.length && !errors.length) errors.push('Replace at least one EXAMPLE row with a real staff member.')
  return { staff, errors, total: lines.length }
}

function dueTime(raw) {
  const text = raw.trim().toUpperCase().replace(/\s+/g, ' ')
  const twelve = /^(1[0-2]|[1-9]):([0-5]\d)\s?(AM|PM)$/.exec(text)
  if (twelve) {
    const hour = Number(twelve[1]) % 12 + (twelve[3] === 'PM' ? 12 : 0)
    return `${String(hour).padStart(2, '0')}:${twelve[2]}`
  }
  const twentyFour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text)
  return twentyFour ? `${twentyFour[1].padStart(2, '0')}:${twentyFour[2]}` : null
}

export function parseCommitmentsCsv(text) {
  const { lines, labels } = table(text, ['commitment', 'applies to', 'repeats', 'due day', 'due time'])
  const commitments = [], errors = [], seen = new Set()
  lines.forEach((cells, i) => {
    const rowNumber = i + 2
    if (cells[0]?.trim().toUpperCase().startsWith('EXAMPLE:')) return
    if (cells.length !== labels.length) { errors.push(`Row ${rowNumber}: expected 5 columns.`); return }
    const [title, rawApplies, rawCadence, rawDay, rawTime] = cells.map(cell => cell.trim())
    const audience = rawApplies.toLowerCase()
    const appliesTo = ['teacher', 'teachers'].includes(audience) ? 'teachers' : ['all', 'all staff', 'everyone'].includes(audience) ? 'all' : null
    const cadence = rawCadence.toLowerCase(), day = days.indexOf(rawDay.toLowerCase()), time = dueTime(rawTime)
    const monthDayText = rawDay.toLowerCase().replace(/\s+/g, ' ').trim()
    const monthDay = /^(first day of (the )?month|first|1st|1)$/.test(monthDayText) ? 1
      : /^(last day of (the )?month|last)$/.test(monthDayText) ? 31
        : /^([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?$/.test(monthDayText) ? Number(monthDayText.match(/^\d+/)[0]) : null
    if (title.length < 2 || title.length > 120 || !appliesTo || !['daily', 'weekly', 'monthly'].includes(cadence) || (cadence === 'weekly' && day < 0) || (cadence === 'daily' && !!rawDay) || (cadence === 'monthly' && !monthDay) || !time) {
      errors.push(`Row ${rowNumber}: use Teacher or All staff; Daily, Weekly, or Monthly; a weekday for Weekly or a date such as First day of the Month for Monthly; and a time such as 10:00 AM.`); return
    }
    const key = `${title.toLowerCase()}:${appliesTo}:${cadence}:${cadence === 'monthly' ? monthDay : day}:${time}`
    if (seen.has(key)) { errors.push(`Row ${rowNumber}: duplicate commitment in this file.`); return }
    seen.add(key)
    commitments.push({ title, applies_to: appliesTo, cadence, due_weekday: cadence === 'weekly' ? day : null, due_monthday: cadence === 'monthly' ? monthDay : null, due_time: time })
  })
  if (!commitments.length && !errors.length) errors.push('Replace at least one EXAMPLE row with a real commitment.')
  if (commitments.length > 100) errors.push('Import at most 100 commitments at once.')
  return { commitments, errors, total: lines.length }
}
