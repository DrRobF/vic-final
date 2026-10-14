import crypto from 'node:crypto'

// Reads Google Sheets as AskVic's read-only Google account (a service account).
// Schools share a sheet with that account's email as Viewer; nothing else is needed on their side.
let cached = null

function credentials() {
 const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
 if (!raw) throw Object.assign(new Error('Google Sheets isn’t set up on this server yet.'), { setup: true })
 let key
 try { key = JSON.parse(raw) } catch { throw Object.assign(new Error('The Google key on this server is not valid JSON.'), { setup: true }) }
 if (!key.client_email || !key.private_key) throw Object.assign(new Error('The Google key on this server is incomplete.'), { setup: true })
 return key
}

export function serviceEmail() { try { return credentials().client_email } catch { return '' } }

const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')

async function accessToken() {
 if (cached && cached.expires > Date.now() + 60_000) return cached.token
 const key = credentials(), now = Math.floor(Date.now() / 1000)
 const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
 const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url')
 const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(10000) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok || !d.access_token) throw Object.assign(new Error('AskVic couldn’t sign in to Google. Check the Google key in Vercel.'), { userFacing: true })
 cached = { token: d.access_token, expires: Date.now() + (d.expires_in || 3600) * 1000 }
 return cached.token
}

async function google(path) {
 const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(15000) })
 const d = await r.json().catch(() => ({}))
 if (r.status === 403 || r.status === 404) throw Object.assign(new Error(`AskVic can’t open that sheet yet. In Google Sheets, click Share, add ${serviceEmail()} as a Viewer, then try again.`), { notShared: true })
 if (!r.ok) throw Object.assign(new Error(d?.error?.message ? `Google said: ${d.error.message}` : 'Google Sheets didn’t answer. Please try again.'), { userFacing: true })
 return d
}

// Accepts a full Google Sheets link or a bare spreadsheet id.
export function spreadsheetId(input) {
 const s = String(input || '').trim()
 const m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/^([A-Za-z0-9_-]{30,})$/)
 return m ? m[1] : ''
}

export async function sheetInfo(id) {
 const d = await google(`${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`)
 return { title: d.properties?.title || 'Spreadsheet', tabs: (d.sheets || []).map(s => s.properties?.title).filter(Boolean) }
}

// All values in a tab, as displayed in Sheets (dates come back the way the school sees them).
export async function tabValues(id, tab) {
 const range = `'${String(tab).replace(/'/g, "''")}'`
 const d = await google(`${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`)
 const values = Array.isArray(d.values) ? d.values : []
 // Skip blank rows above the header (Google Forms sheets sometimes have them).
 const start = values.findIndex(r => r.filter(c => String(c || '').trim()).length >= 2)
 return start < 0 ? [] : values.slice(start)
}
