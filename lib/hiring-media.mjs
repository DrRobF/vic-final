// Where applicant video and resumes live, and what is allowed to be written there.
//
// Mirrors how Saint Peter's own site does it, with one change: AskVic already has Supabase, so the
// upload goes to Supabase Storage through a signed URL instead of to Vercel Blob. Either way the
// bytes go straight from the browser to storage. A five-minute recording cannot be posted through a
// serverless function -- the request body limit is a few megabytes and the file is tens.
//
// The important rule in here is verifiedPath. A candidate asks the server for an upload URL and
// names the path they want to write to. If that path is not checked against their own session, a
// candidate can request a URL for somebody else's folder and overwrite their application, or write
// a file that a later read will serve to a principal as if it were theirs.

export const BUCKET = 'hiring-media'
export const MAX_VIDEO_BYTES = 90 * 1024 * 1024
export const MAX_RESUME_BYTES = 10 * 1024 * 1024
export const VIDEO_LIMIT_SECONDS = 300

export const VIDEO_TYPES = ['video/webm', 'video/mp4', 'video/quicktime']
export const RESUME_TYPES = [
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const VIDEO_EXT = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }
const RESUME_EXT = {
 'application/pdf': 'pdf',
 'application/msword': 'doc',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

const UUID = /^[0-9a-f-]{36}$/i

export const candidatePrefix = candidateId => `candidates/${candidateId}/`

// A fresh name every time, so a retake never half-overwrites the take before it: a storage write
// that replaces a file in place can be read mid-write, and the old row is deleted only once the
// new one is confirmed.
export function uploadPath(candidateId, kind, contentType, unique) {
 if (!UUID.test(String(candidateId || ''))) return ''
 const stamp = String(unique || '').replace(/[^a-z0-9]/gi, '').slice(0, 32).toLowerCase()
 if (stamp.length < 8) return ''
 if (kind === 'resume') {
  const ext = RESUME_EXT[contentType]
  return ext ? `${candidatePrefix(candidateId)}resume-${stamp}.${ext}` : ''
 }
 const match = /^q([1-9]|1[0-9]|20)$/.exec(String(kind || ''))
 if (!match) return ''
 const ext = VIDEO_EXT[contentType]
 return ext ? `${candidatePrefix(candidateId)}${match[0]}-${stamp}.${ext}` : ''
}

// The guard. Returns true only for a path inside this candidate's own folder, named the way this
// server names files, for the kind of file being claimed.
export function verifiedPath(candidateId, kind, path) {
 if (!UUID.test(String(candidateId || ''))) return false
 const prefix = candidatePrefix(candidateId)
 const full = String(path || '')
 if (!full.startsWith(prefix)) return false
 const relative = full.slice(prefix.length)
 // No traversal, no nesting, no empty name.
 if (!relative || relative.includes('/') || relative.includes('..')) return false
 if (kind === 'resume') return /^resume-[a-z0-9]{8,32}\.(pdf|doc|docx)$/.test(relative)
 const match = /^q([1-9]|1[0-9]|20)-[a-z0-9]{8,32}\.(webm|mp4|mov)$/.exec(relative)
 return Boolean(match && kind === `q${match[1]}`)
}

// What a recording actually is, judged by its first bytes rather than by what the browser said it
// would record. A browser can accept a request for WebM and return something else; MediaRecorder's
// own mimeType is only its word for it. Believe either and the file is stored under a content type
// that contradicts its contents -- which a panel member meets as a black player, a duration of zero,
// and a candidate who appears to have submitted nothing.
export function sniffVideoType(head, fallback = '') {
 const bytes = head || []
 const at = i => Number(bytes[i])
 // EBML, the Matroska and WebM header.
 if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return 'video/webm'
 // ISO base media: a size field, then 'ftyp', then the brand that says which flavour.
 const ascii = (from, to) => String.fromCharCode(...[...bytes].slice(from, to).map(Number))
 if (ascii(4, 8) === 'ftyp') return ascii(8, 12).startsWith('qt') ? 'video/quicktime' : 'video/mp4'
 return fallback
}

export function allowedUpload(kind, contentType, bytes) {
 const type = String(contentType || '').split(';')[0].trim().toLowerCase()
 const size = Number(bytes)
 if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'That file appears to be empty.' }
 if (kind === 'resume') {
  if (!RESUME_TYPES.includes(type)) return { ok: false, error: 'Attach your resume as a PDF or Word document.' }
  if (size > MAX_RESUME_BYTES) return { ok: false, error: 'Keep your resume under 10 MB.' }
  return { ok: true, type }
 }
 if (!VIDEO_TYPES.includes(type)) return { ok: false, error: 'That video format is not supported. Most phones and laptops record MP4 or WebM.' }
 if (size > MAX_VIDEO_BYTES) {
  return { ok: false, error: 'That recording is over 90 MB. Record at a lower resolution, or keep the answer closer to five minutes.' }
 }
 return { ok: true, type }
}

// Session tokens for a candidate who has entered their code. Long, random, and stored on the row so
// a school leader can revoke one; never a signed cookie, because this feature should not need a
// signing secret of its own.
export function makeSessionToken(bytes) {
 const source = bytes || (globalThis.crypto?.getRandomValues?.(new Uint8Array(32)) ?? null)
 if (!source) throw new Error('No source of randomness for a session token.')
 return Array.from(source, b => b.toString(16).padStart(2, '0')).join('')
}

export const SESSION_DAYS = 14
export const sessionExpiry = (now = Date.now()) => new Date(now + SESSION_DAYS * 86400000).toISOString()

// Applicant video is personal information about people who do not work here. Every candidate gets a
// disposal date when they are invited, rather than a vague intention to tidy up later.
export const RETENTION_DAYS = 180
export function disposalDate(now = Date.now()) {
 return new Date(now + RETENTION_DAYS * 86400000).toISOString().slice(0, 10)
}

export const RECORDING_NOTICE =
 'Your video answers are recorded and reviewed by the school leaders on this hiring panel. They are ' +
 'stored privately, are not published anywhere, are used only for this hiring process, and are ' +
 `deleted within ${RETENTION_DAYS} days of the position being filled. If you would prefer an ` +
 'interview that does not involve recording, call the school office and we will arrange one.'
