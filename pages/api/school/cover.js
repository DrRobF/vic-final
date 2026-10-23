import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import { schoolToday } from '../../../lib/release.mjs'
import { plannedToday } from '../../../lib/lesson-launch.mjs'
import { newCoverCode, coverGrantInput } from '../../../lib/cover.mjs'
export const config = { api: { bodyParser: { sizeLimit: '8kb' } }, maxDuration: 30 }

// The principal's side of sub coverage: hand a day's lessons to whoever is covering.
//
// GET  ?schoolId=        -> classes that can be covered, who is out today, and live slips
// POST {action:'create'} -> a slip: who is covering, which classes, which day, and a code
// POST {action:'revoke'} -> take a slip back (the sub did not come, the teacher made it in)
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requirePrincipal(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 const school = await requireSchool(auth, req.method === 'GET' ? req.query.schoolId : req.body?.schoolId)
 if (school.error) return res.status(school.status).json({ error: school.error })
 const db = auth.admin, today = schoolToday()
 try {
  if (req.method === 'GET') {
   // Only staff whose attendance record is tied to their login have classes we can find;
   // that link is what makes "who is out" and "whose lessons" the same question.
   const [{ data: staff }, { data: classes }, { data: grants }] = await Promise.all([
    db.from('ap_staff').select('id,display_name,auth_user_id').eq('school_id', school.schoolId).eq('active', true).limit(500),
    db.from('classes').select('id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id,name)').order('class_name').limit(500),
    db.from('cover_grants').select('id,day,class_ids,covering_name,code,note,created_at,revoked_at,last_opened_at')
     .eq('school_id', school.schoolId).gte('day', today).order('day').limit(100),
   ])
   const authToStaff = new Map((staff || []).filter(s => s.auth_user_id).map(s => [s.auth_user_id, s]))
   // A class is coverable when AskVic knows whose it is, because the lessons come from its teacher.
   const coverable = (classes || []).filter(c => c.users?.auth_user_id && authToStaff.has(c.users.auth_user_id))
   const planned = await plannedToday(db, coverable.map(c => c.id), today)
   return res.json({
    today,
    classes: coverable.map(c => ({
     id: c.id, name: c.class_name, grade: c.grade_level ?? null,
     teacher: c.users?.name || '',
     staffId: authToStaff.get(c.users.auth_user_id)?.id || null,
     plannedToday: planned.filter(p => Number(p.classId) === Number(c.id)).map(p => ({ title: p.title, ready: p.ready, live: p.live })),
    })),
    // Named so the principal can pick "cover Mrs. Morgan" rather than hunting her classes.
    teachers: [...new Map(coverable.map(c => [c.users.auth_user_id, {
     staffId: authToStaff.get(c.users.auth_user_id)?.id || null,
     name: c.users?.name || '',
     classIds: coverable.filter(x => x.users.auth_user_id === c.users.auth_user_id).map(x => x.id),
    }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    grants: (grants || []).map(g => ({
     id: g.id, day: g.day, classIds: (g.class_ids || []).map(Number), coveringName: g.covering_name,
     code: g.code, note: g.note || '', revoked: !!g.revoked_at, opened: !!g.last_opened_at,
    })),
   })
  }

  if (req.body?.action === 'revoke') {
   const id = String(req.body?.grantId || '')
   if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Choose a cover slip.' })
   const { data: mine } = await db.from('cover_grants').select('id').eq('id', id).eq('school_id', school.schoolId).maybeSingle()
   if (!mine) return res.status(404).json({ error: 'That cover slip is not yours.' })
   const { error } = await db.from('cover_grants').update({ revoked_at: new Date().toISOString() }).eq('id', id)
   if (error) throw error
   return res.json({ revoked: true })
  }

  if (req.body?.action === 'create') {
   let input; try { input = coverGrantInput(req.body) } catch (e) { return res.status(400).json({ error: e.message }) }
   if (input.day < today) return res.status(400).json({ error: 'Cover cannot be set for a day that has passed.' })
   // Every class must be one this school can actually cover, or a good code would reach
   // a class the principal never meant to include.
   const { data: owned } = await db.from('classes').select('id,teacher_id,users:teacher_id(auth_user_id)').in('id', input.classIds)
   if ((owned || []).length !== input.classIds.length) return res.status(400).json({ error: 'One of those classes no longer exists.' })
   const authIds = [...new Set((owned || []).map(c => c.users?.auth_user_id).filter(Boolean))]
   const { data: staff } = authIds.length
    ? await db.from('ap_staff').select('auth_user_id').eq('school_id', school.schoolId).eq('active', true).in('auth_user_id', authIds)
    : { data: [] }
   const known = new Set((staff || []).map(s => s.auth_user_id))
   if ((owned || []).some(c => !c.users?.auth_user_id || !known.has(c.users.auth_user_id))) {
    return res.status(400).json({ error: 'One of those classes belongs to a teacher who is not on this school’s staff list.' })
   }
   // Codes are unique; a collision is vanishingly rare but cheap to retry.
   for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCoverCode()
    const { data, error } = await db.from('cover_grants').insert({
     school_id: school.schoolId, day: input.day, class_ids: input.classIds,
     covering_name: input.coveringName, code, note: input.note, created_by: auth.user.id,
    }).select('id,code,day,class_ids,covering_name,note').maybeSingle()
    if (!error && data) return res.json({ grant: { id: data.id, code: data.code, day: data.day, classIds: (data.class_ids || []).map(Number), coveringName: data.covering_name, note: data.note || '' } })
    if (error && !String(error.message || '').includes('cover_grants_code_key')) throw error
   }
   return res.status(503).json({ error: 'Could not make a code just now. Please try again.' })
  }

  return res.status(400).json({ error: 'Unknown action.' })
 } catch (error) {
  console.error('[school/cover] failed', { message: error?.message })
  return res.status(503).json({ error: 'Something went wrong. Please try again.' })
 }
}
