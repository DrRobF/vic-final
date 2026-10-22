import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import TextSizeControl from './TextSizeControl'
import { readLeader, readMode, saveMode, rememberLeader } from '../lib/view-mode'

// One top bar for the whole site, in the Midnight Circuit look.
// Who is signed in decides the menu: visitors, educators and students each see only their own places.
const VISITOR_NAV = [
 { href: '/', label: 'Home' },
 { href: '/lessonplan', label: 'Lesson Designer' },
 { href: '/vic', label: 'Meet VIC' },
 { href: '/educatorassistant', label: 'Assistant' },
]
const EDUCATOR_NAV = [
 { href: '/teach', label: 'My Week', match: ['/teach', '/educator', '/lessonplan/week'] },
 { href: '/lessons', label: 'My Lessons', match: ['/lessons', '/lessonplan', '/lesson'] },
 { href: '/classes', label: 'My Classes', match: ['/classes', '/askvic', '/teacher', '/assignlesson'] },
 { href: '/parentletters', label: 'Families', match: ['/parentletters'] },
]
const SCHOOL_NAV = [
 { href: '/school', label: 'Dashboard', match: ['/school'] },
 { href: '/room', label: 'VIC Room', match: ['/room'] },
 { href: '/walkthroughs', label: 'Walkthroughs', match: ['/walkthroughs'] },
 { href: '/weeklyplans', label: 'Lesson plans', match: ['/weeklyplans'] },
 { href: '/school/payroll', label: 'Payroll', match: ['/school/payroll'] },
 { href: '/school/setup', label: '⚙ Setup', match: ['/school/setup', '/school/attendance', '/assistantprincipal', '/admin'] },
]
const SCHOOL_PATHS = ['/room', '/school', '/weeklyplans', '/walkthroughs', '/assistantprincipal', '/admin']
const STUDENT_NAV = [
 { href: '/learn', label: 'Today', match: ['/learn', '/student'] },
 { href: '/askvic', label: 'VIC', match: ['/askvic'] },
]

function displayName(profile, user) { return profile?.name || profile?.email || user?.email || '' }
function isActive(item, currentPath) {
 const paths = item.match || [item.href]
 if (item.href === '/school') return currentPath === '/school'
 // The most specific match wins, so "/lessonplan/week" lights up My Week rather than Lessons.
 return paths.some(p => currentPath === p || (p !== '/' && currentPath.startsWith(p + '/') && !(item.href === '/lessons' && currentPath.startsWith('/lessonplan/week'))))
}

export default function VICHeader({ currentPath = '', statusLabel = '', statusTone = 'ready' }) {
 const [authUser, setAuthUser] = useState(null)
 const [profile, setProfile] = useState(null)
 const [loggingOut, setLoggingOut] = useState(false)
 const [open, setOpen] = useState(false)
 const [lead, setLead] = useState(null)

 useEffect(() => {
  let mounted = true
  async function load() {
   const { data: { user } } = await supabase.auth.getUser()
   if (!mounted) return
   setAuthUser(user || null)
   if (!user?.email) { setProfile(null); return }
   const { data } = await supabase.from('users').select('name, email, role').eq('auth_user_id', user.id).order('id', { ascending: true }).limit(1)
   if (mounted) setProfile(data?.[0] || null)
  }
  load()
  setLead(readLeader())
  const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => { setAuthUser(session?.user || null); if (!session?.user) setProfile(null) })
  return () => { mounted = false; listener?.subscription?.unsubscribe() }
 }, [])

 const name = useMemo(() => displayName(profile, authUser), [profile, authUser])
 const isStudent = profile?.role === 'student'
 const schoolSide = !!lead && SCHOOL_PATHS.some(p => currentPath === p || currentPath.startsWith(p + '/'))
 const nav = !authUser ? VISITOR_NAV : isStudent ? STUDENT_NAV : schoolSide ? SCHOOL_NAV : EDUCATOR_NAV
 const home = !authUser ? '/' : isStudent ? '/learn' : lead && readMode() !== 'teacher' ? '/school' : '/teach'
 function switchTo(mode) { saveMode(mode); window.location.href = mode === 'teacher' ? '/teach' : '/school' }

 async function logout() {
  if (loggingOut) return
  setLoggingOut(true)
  rememberLeader({})
  await supabase.auth.signOut()
  window.location.href = isStudent ? '/hello' : '/login'
 }

 return (
  <header className="vicHeader">
   <a className="brand" href={home} aria-label="AskVic home">
    <span className="mark" aria-hidden="true">V</span>
    <span className="word">AskVic</span>
   </a>
   <button type="button" className="menuToggle" aria-expanded={open} aria-controls="vic-primary-nav" onClick={() => setOpen(!open)}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    <span className="sr">Menu</span>
   </button>
   <nav id="vic-primary-nav" className={open ? 'nav open' : 'nav'} aria-label="Primary">
    {nav.map(item => <a key={item.href} href={item.href} className={isActive(item, currentPath) ? 'active' : ''} aria-current={isActive(item, currentPath) ? 'page' : undefined}>{item.label}</a>)}
   </nav>
   <div className="right">
    {statusLabel ? <span className={`status ${statusTone === 'thinking' ? 'thinking' : ''}`}><span className="dot" aria-hidden="true" />{statusLabel}</span> : null}
    {authUser && !isStudent && lead && <button type="button" className="modeSwitch" onClick={() => switchTo(schoolSide ? 'teacher' : 'school')}>{schoolSide ? 'My teaching →' : 'School view →'}</button>}
    <a className={currentPath === '/help' ? 'helpLink on' : 'helpLink'} href="/help" aria-current={currentPath === '/help' ? 'page' : undefined}><span className="q" aria-hidden="true">?</span>Help</a>
    {authUser && <TextSizeControl tone="dark" />}
    {authUser ? <>
     <span className="who" title={name}>{name || 'Signed in'}</span>
     <button type="button" className="ghost" onClick={logout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
    </> : <>
     <a className="ghost" href="/login">Log in</a>
     <a className="cta" href="/signup">Sign up free</a>
    </>}
   </div>
   <style jsx>{`
    .vicHeader{display:flex;align-items:center;gap:24px;padding:12px 24px;background:var(--vic-ink);color:var(--vic-ink-text);border-radius:16px;margin-bottom:12px;flex-wrap:wrap}
    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;flex-shrink:0}
    .mark{width:38px;height:38px;border-radius:10px;background:var(--vic-ink-2);border:1px solid var(--vic-ink-line);color:var(--vic-cyan);display:grid;place-items:center;font-family:var(--font-head);font-weight:700;font-size:19px}
    .word{font-family:var(--font-head);font-weight:700;font-size:21px;letter-spacing:-.01em}
    .nav{display:flex;gap:4px;flex-wrap:wrap}
    .nav a{padding:9px 14px;border-radius:9px;color:var(--vic-ink-muted);text-decoration:none;font-weight:700;font-size:16px;white-space:nowrap}
    .nav a:hover{color:#fff;background:var(--vic-ink-2)}
    .nav a.active{background:var(--vic-primary);color:#fff}
    .right{margin-left:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .who{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;color:var(--vic-ink-muted)}
    .ghost,.cta{padding:9px 14px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap}
    .ghost{border:1px solid var(--vic-ink-line);background:transparent;color:var(--vic-ink-text)}
    .modeSwitch{padding:8px 13px;border-radius:10px;border:1px solid var(--vic-cyan);background:rgba(34,211,238,.12);color:var(--vic-cyan);font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap}
    .modeSwitch:hover{background:rgba(34,211,238,.22)}
    .ghost:hover{background:var(--vic-ink-2)}
    .helpLink{display:inline-flex;align-items:center;gap:7px;padding:7px 13px 7px 8px;border-radius:999px;border:1px solid var(--vic-cyan);color:#fff;text-decoration:none;font-weight:800;font-size:15px;white-space:nowrap}
    .helpLink:hover{background:rgba(34,211,238,.16)}
    .helpLink .q{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--vic-cyan);color:var(--vic-ink);font-size:14px;font-weight:900;line-height:1}
    .helpLink.on .q{background:#fff;color:var(--vic-primary)}
    .helpLink.on{background:var(--vic-primary);color:#fff}
    .ghost:disabled{opacity:.6}
    .cta{background:var(--vic-primary);color:#fff;border:1px solid var(--vic-primary)}
    .cta:hover{background:var(--vic-primary-hover)}
    .status{display:inline-flex;align-items:center;gap:8px;padding:6px 11px;border-radius:999px;border:1px solid var(--vic-ink-line);font-size:14px;font-weight:700}
    .dot{width:9px;height:9px;border-radius:50%;background:var(--vic-volt);box-shadow:0 0 10px rgba(106, 131, 188,.6)}
    .status.thinking .dot{background:var(--vic-cyan);box-shadow:0 0 10px rgba(91, 118, 181,.6)}
    .menuToggle{display:none;margin-left:auto;background:transparent;border:1px solid var(--vic-ink-line);color:#fff;border-radius:10px;padding:8px;cursor:pointer}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
    @media(max-width:900px){
     .vicHeader{padding:10px 14px;gap:10px}
     .menuToggle{display:inline-flex}
     .nav{display:none;order:3;width:100%;flex-direction:column}
     .nav.open{display:flex}
     .right{order:4;width:100%;margin-left:0;justify-content:flex-start}
     .who{display:none}
    }
    @media print{.vicHeader{display:none}}
   `}</style>
  </header>
 )
}
