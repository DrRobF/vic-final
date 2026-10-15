// Client-side helpers for the principal dashboard and the staff panel.
import { fmt12 } from './payroll.mjs'

// "Green, Karen" → "Karen Green"
export const displayName = n => { const s = String(n || '').trim(); if (!s.includes(',')) return s; const [last, first] = s.split(','); return `${first.trim()} ${last.trim()}`.trim() }
export const firstName = n => displayName(n).split(/\s+/)[0] || ''
const lastName = n => { const s = String(n || '').trim(); return (s.includes(',') ? s.split(',')[0] : s.split(/\s+/).slice(-1)[0] || '').trim().toLowerCase() }
export const byLastName = (a, b) => lastName(a.name).localeCompare(lastName(b.name)) || displayName(a.name).localeCompare(displayName(b.name))

export const fmtDay = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => d ? new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' }) : ''
export const daysAgo = iso => iso ? Math.floor((Date.now() - Date.parse(iso)) / 864e5) : null
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
export { plural, fmt12 }

// Colorblind-safe: every state has its own fill, symbol and words — color is never the only signal.
export function tileState(p) {
 const t = p.today || {}
 if (t.kind === 'in') return { cls: 'here', icon: '✓', text: t.marked ? 'Here (marked)' : t.time ? `In ${fmt12(t.time)}` : 'Here', word: 'Here' }
 if (t.kind === 'late') return { cls: 'late', icon: '⏰', text: t.minutes ? `${t.minutes} min late` : 'Late', word: 'Late' }
 if (t.kind === 'absent_no_form') return { cls: 'missing', icon: '!', text: 'No check-in', word: 'Missing' }
 if (t.kind === 'absent_form') return { cls: 'told', icon: '✉', text: `Out · ${t.type || 'Absent'}`, word: 'Out' }
 if (t.kind === 'waiting') return { cls: 'waiting', icon: '·', text: t.due ? `Due ${fmt12(t.due)}` : 'Not in yet', word: 'Not due yet' }
 return { cls: 'off', icon: '–', text: p.flexible ? 'Flexible hours' : 'Off today', word: 'Off' }
}

export const MARK_OPTIONS = [
 ['sick', 'Sick'], ['personal', 'Personal'], ['half', 'Half day'], ['pd', 'PD / school business (free)'],
 ['excused', 'Excused (doesn’t count)'], ['unpaid', 'Unpaid'], ['present', 'Was here (forgot to check in)'],
]
export const ROLES = [['teacher', 'Teacher'], ['support', 'Support staff'], ['office', 'Office'], ['leader', 'Leadership'], ['other', 'Other']]
