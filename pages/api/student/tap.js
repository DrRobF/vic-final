import { createClient } from '@supabase/supabase-js'
import { requireApprovedProfile } from '../../../lib/server-auth'
import { newToken, tokenHash } from '../../../lib/kiosk.mjs'

// Children tap their name instead of typing a password.
//
// A third grader forgets a password daily, so they should not have one. They identify
// themselves; the credential is the classroom device, set up once by their teacher.
//
// Three things happen here:
//   register  a signed-in teacher turns this computer into a class device (returns a token)
//   list      that device asks who is in its class (no sign-in needed, the token is proof)
//   enter     a child taps a name, and gets a session for that child
//
// 'enter' mints a one-time token for the child's own account using the same mechanism as
// an email sign-in link, so no password is involved and nothing is emailed. Anyone with
// the device token can sign in as any child in that one class -- that is the agreed
// trade-off, and why the token is random, hashed, and revocable rather than a class code
// like G3M26 that anyone could guess.

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const username = email => String(email || '').split('@')[0] || ''

async function deviceFor(db, token) {
 if (typeof token !== 'string' || token.length < 20) return null
 const { data, error } = await db.from('class_devices')
  .select('id,class_id,school_id,label,revoked').eq('token_hash', tokenHash(token)).maybeSingle()
 if (error) throw error
 return data && !data.revoked ? data : null
}

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  return res.status(503).json({ error: 'Name sign-in is not set up yet.' })
 }

 const action = req.body?.action
 try {
  const db = admin()

  // --- The teacher sets this computer up, once, while signed in. --------------------
  if (action === 'register') {
   const auth = await requireApprovedProfile(req)
   if (auth.error) return res.status(auth.status).json({ error: auth.error })
   if (String(auth.profile.role).toLowerCase() !== 'teacher') return res.status(403).json({ error: 'Only a teacher can set up a classroom computer.' })

   const classId = Number(req.body?.classId)
   if (!Number.isSafeInteger(classId) || classId <= 0) return res.status(400).json({ error: 'Choose a class.' })

   // Their own class only, so one teacher cannot open another's register.
   const { data: klass, error: kErr } = await db.from('classes').select('id,class_name,teacher_id').eq('id', classId).maybeSingle()
   if (kErr) throw kErr
   if (!klass || klass.teacher_id !== auth.profile.id) return res.status(403).json({ error: 'That is not one of your classes.' })

   const { data: school } = await db.from('ap_staff').select('school_id').eq('auth_user_id', auth.user.id).eq('active', true).limit(1).maybeSingle()
   if (!school?.school_id) return res.status(409).json({ error: 'Join your school in AskVic first, then set this computer up.' })

   const token = newToken()
   const label = String(req.body?.label || '').trim().slice(0, 80)
   const { error: insErr } = await db.from('class_devices').insert({
    school_id: school.school_id, class_id: classId, label, token_hash: tokenHash(token), created_by: auth.user.id,
   })
   if (insErr) throw insErr
   return res.json({ token, className: klass.class_name })
  }

  // --- The device asks who is in its class. ----------------------------------------
  if (action === 'list') {
   const device = await deviceFor(db, req.body?.token)
   if (!device) return res.status(401).json({ error: 'This computer is not set up for a class any more. Ask your teacher.' })

   const [{ data: klass }, { data: enrols, error: eErr }] = await Promise.all([
    db.from('classes').select('class_name').eq('id', device.class_id).maybeSingle(),
    db.from('enrollments').select('student_id').eq('class_id', device.class_id).limit(500),
   ])
   if (eErr) throw eErr
   const ids = (enrols || []).map(e => e.student_id)
   const { data: kids, error: sErr } = ids.length
    ? await db.from('users').select('id,name,email,auth_user_id').in('id', ids).eq('role', 'student').order('name')
    : { data: [] }
   if (sErr) throw sErr

   await db.from('class_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)
   return res.json({
    className: klass?.class_name || 'Your class',
    students: (kids || []).filter(k => k.auth_user_id).map(k => ({ id: k.id, name: k.name || username(k.email) })),
   })
  }

  // --- A child taps their name. ----------------------------------------------------
  if (action === 'enter') {
   const device = await deviceFor(db, req.body?.token)
   if (!device) return res.status(401).json({ error: 'This computer is not set up for a class any more. Ask your teacher.' })

   const studentId = Number(req.body?.studentId)
   if (!Number.isSafeInteger(studentId) || studentId <= 0) return res.status(400).json({ error: 'Tap your name.' })

   // The child must really be in this device's class: the token alone is not enough.
   const { data: enrolled, error: enErr } = await db.from('enrollments').select('student_id').eq('class_id', device.class_id).eq('student_id', studentId).maybeSingle()
   if (enErr) throw enErr
   if (!enrolled) return res.status(403).json({ error: 'That name is not in this class.' })

   const { data: kid, error: kidErr } = await db.from('users').select('id,name,email,role,auth_user_id').eq('id', studentId).maybeSingle()
   if (kidErr) throw kidErr
   if (!kid || String(kid.role).toLowerCase() !== 'student' || !kid.auth_user_id) return res.status(409).json({ error: 'That account is not ready yet. Ask your teacher.' })

   // A one-time sign-in token for this child. Nothing is emailed; the page below
   // exchanges it for a session immediately.
   const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email: kid.email })
   if (linkErr || !link?.properties?.hashed_token) return res.status(503).json({ error: 'Could not sign you in. Try again.' })

   await db.from('class_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id)
   return res.json({ tokenHash: link.properties.hashed_token, name: kid.name || '' })
  }

  return res.status(400).json({ error: 'Unknown action.' })
 } catch (e) {
  console.error('student tap', { action, name: e?.name })
  return res.status(503).json({ error: 'Something went wrong. Please try again.' })
 }
}
