import { useEffect, useState } from 'react'
import css from 'styled-jsx/css'
import { supabase } from '../lib/supabase'

// Shown at the top of My Week to a teacher who has not joined a school yet.
// If their school leader already put this sign-in email on the staff list, joining is one click
// with no code. Otherwise they type the school code right here. Either way they never have to
// find askvic.ai/join on their own. Teachers already in a school never see this card.

const DISMISS_KEY = 'askvic-join-card-dismissed'

async function call(body) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) throw new Error('Please log in again.')
 const r = await fetch('/api/educator/join-school', {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
 })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}

export default function JoinSchoolCard() {
 const [state, setState] = useState(null)
 const [code, setCode] = useState('')
 const [agree, setAgree] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [joined, setJoined] = useState('')

 useEffect(() => {
  let dismissed = false
  try { dismissed = window.localStorage.getItem(DISMISS_KEY) === '1' } catch {}
  call().then(d => {
   if (d.schools?.length) return
   if (dismissed && !d.invites?.length) return
   setState({ invites: d.invites || [], consent: d.consent || '' })
  }).catch(() => {})
 }, [])

 async function join(body) {
  setBusy(true); setError('')
  try {
   const d = await call({ ...body, agree: true })
   setJoined(d.school?.name || 'your school')
  } catch (e) { setError(e.message) } finally { setBusy(false) }
 }

 function notNow() {
  try { window.localStorage.setItem(DISMISS_KEY, '1') } catch {}
  setState(null)
 }

 if (joined) return (
  <section className="join done" role="status">
   <strong>✓ You’ve joined {joined}.</strong>
   <span>Your lesson plans can now go straight to your principal from My Week.</span>
   <style jsx>{styles}</style>
  </section>
 )
 if (!state) return null

 const invite = state.invites[0]
 return (
  <section className="join" aria-labelledby="join-title">
   <div className="text">
    <p className="eyebrow">One-time step</p>
    <h2 id="join-title">{invite ? `${invite.name} added you to its staff` : 'Does your school use AskVic?'}</h2>
    <p className="lead">{invite ? 'Join so your lesson plans go straight to your principal.' : 'Enter the code your principal gave you so your lesson plans go straight to them.'}</p>
   </div>
   <form onSubmit={e => { e.preventDefault(); if (agree) join(invite ? { schoolId: invite.schoolId } : { code }) }}>
    {!invite && <>
     <label htmlFor="join-code">School code</label>
     <input id="join-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SPA-4821" autoComplete="off" maxLength={12} required />
    </>}
    <label className="check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>{state.consent}</span></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
     <button type="submit" className="primary" disabled={busy || !agree || (!invite && code.trim().length < 7)}>{busy ? 'Joining…' : invite ? `Join ${invite.name}` : 'Join my school'}</button>
     {!invite && <button type="button" className="quiet" onClick={notNow}>I don’t have a school code</button>}
    </div>
   </form>
   <style jsx>{styles}</style>
  </section>
 )
}

const styles = css`
 .join{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:22px;align-items:start;padding:22px 24px;margin:0 0 20px;border-radius:16px;background:var(--vic-surface);border:2px solid var(--vic-primary);box-shadow:0 10px 30px rgba(29,78,216,.12)}
 .join.done{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;border-color:var(--vic-success, #16a34a);box-shadow:none}
 .done strong{font-size:17px}
 .done span{color:var(--vic-text-secondary)}
 .eyebrow{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--vic-primary)}
 h2{margin:0 0 6px;font-family:var(--font-head);font-size:23px;line-height:1.2}
 .lead{margin:0;font-size:16px;line-height:1.55;color:var(--vic-text-secondary)}
 form{display:grid;gap:10px;min-width:0}
 label{font-size:14px;font-weight:800}
 input:not([type=checkbox]){width:100%;padding:12px 14px;border:1px solid var(--vic-border);border-radius:10px;font:inherit;font-size:18px;letter-spacing:.06em;text-transform:uppercase;background:var(--vic-surface);color:var(--vic-text-primary)}
 .check{display:flex;gap:10px;align-items:flex-start;font-weight:500;font-size:14px;line-height:1.5;color:var(--vic-text-secondary)}
 .check input{margin-top:3px;width:18px;height:18px;flex:0 0 auto}
 .actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
 .primary{padding:12px 18px;border-radius:10px;border:0;background:var(--vic-primary);color:#fff;font-weight:800;font-size:16px;cursor:pointer}
 .primary:disabled{opacity:.5;cursor:not-allowed}
 .quiet{padding:10px 6px;border:0;background:none;color:var(--vic-text-secondary);font-weight:700;text-decoration:underline;cursor:pointer}
 .error{margin:0;color:var(--vic-danger)}
 @media(max-width:760px){.join{grid-template-columns:1fr}}
`
