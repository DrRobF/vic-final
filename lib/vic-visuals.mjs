// Visuals VIC can actually show.
//
// VIC decides when a picture helps by ending a reply with ONE tag line, for example:
//   [[VIC_VISUAL: fraction 3/8]]
//   [[VIC_VISUAL: compare 2/4 1/2]]
//   [[VIC_VISUAL: numberline 0 10 7]]
//   [[VIC_VISUAL: array 3x4]]
// The server checks the tag, removes it from the text, and sends a small visual object the page
// draws. Anything malformed, out of range, or unknown is dropped: no picture beats a wrong one.
//
// Before October 2026 the page guessed a visual by grabbing the first fraction it saw in the
// student's message plus VIC's reply, so it usually drew the student's last answer, not VIC's
// question.

const TAG = /\n?[ \t]*\[\[\s*VIC_VISUAL\s*:\s*([^\]]*?)\s*\]\][ \t]*/gi
const MAX_PARTS = 12

function fraction(text) {
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(String(text || '').trim())
  if (!m) return null
  const numerator = Number(m[1]), denominator = Number(m[2])
  if (denominator < 1 || denominator > MAX_PARTS || numerator > denominator) return null
  return { numerator, denominator }
}

export function parseVisual(spec) {
  const [kind, ...rest] = String(spec || '').trim().split(/\s+/)
  const args = rest.join(' ')
  switch ((kind || '').toLowerCase()) {
    case 'fraction': {
      const f = fraction(args)
      return f ? { type: 'fraction', ...f } : null
    }
    case 'compare': {
      const parts = args.split(/\s+(?:and|vs|,)?\s*/).filter(Boolean)
      if (parts.length !== 2) return null
      const a = fraction(parts[0]), b = fraction(parts[1])
      return a && b ? { type: 'compare', fractions: [a, b] } : null
    }
    case 'numberline': {
      const nums = args.split(/\s+/).map(Number)
      if (nums.length !== 3 || nums.some(n => !Number.isInteger(n))) return null
      const [start, end, mark] = nums
      if (end <= start || end - start > 20 || mark < start || mark > end) return null
      return { type: 'numberline', start, end, mark }
    }
    case 'array': {
      const m = /^(\d{1,2})\s*[x×*]\s*(\d{1,2})$/i.exec(args)
      if (!m) return null
      const rows = Number(m[1]), columns = Number(m[2])
      if (rows < 1 || columns < 1 || rows > 10 || columns > 10) return null
      return { type: 'array', rows, columns }
    }
    default:
      return null
  }
}

// Removes every visual tag from VIC's reply and keeps the first valid one.
export function extractVisual(reply) {
  let visual = null
  const text = String(reply || '').replace(TAG, (_, spec) => {
    if (!visual) visual = parseVisual(spec)
    return ''
  }).trim()
  return { text, visual }
}
