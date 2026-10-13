import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { lessonLibraryRequest } from './lesson-library-client'
import { listWeeks } from './lesson-week-client'
import { lessonHome } from '../components/AddToWeek'

async function authHeaders() {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) throw Object.assign(new Error('Please log in to open this lesson.'), { login: true })
 return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
}

// Loads one saved lesson (and which week/day it sits on) for the Print / Teach / Follow up pages.
export function useLesson(id) {
 const [lesson, setLesson] = useState(null), [home, setHome] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
 useEffect(() => {
  if (!id) return
  let active = true
  setLoading(true); setError('')
  lessonLibraryRequest(`?id=${encodeURIComponent(id)}`)
   .then(d => { if (active) setLesson({ ...d.draft, id: d.id }) })
   .catch(e => { if (active) setError(e.message) })
   .finally(() => { if (active) setLoading(false) })
  listWeeks().then(d => { if (active) setHome(lessonHome(d.weeks, id)) }).catch(() => {})
  return () => { active = false }
 }, [id])
 const markStep = useCallback(async (step, done = true) => {
  const r = await fetch('/api/educator/lesson-steps', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ lessonId: id, step, done }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Could not save this step.')
  setLesson(l => l ? { ...l, steps: d.steps } : l)
  return d.steps
 }, [id])
 return { lesson, home, error, loading, markStep }
}
