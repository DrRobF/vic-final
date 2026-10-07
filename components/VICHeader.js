import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import VICLogo from './VICLogo'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/askvic', label: 'VIC Co-Teacher' },
  { href: '/lessonplan', label: 'Lesson Designer' },
  { href: '/educatorassistant', label: 'Educator Assistant' },
]

const PRIMARY_PATHS = new Set(['/askvic', '/teacher', '/assistantprincipal', '/educatorassistant', '/lessonplan'])

function getDisplayName(profile, authUser) {
  if (profile?.name) return profile.name
  if (profile?.email) return profile.email
  if (authUser?.email) return authUser.email
  return ''
}

export default function VICHeader({ currentPath = '', statusLabel = '', statusTone = 'ready' }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted) return
      setAuthUser(user || null)

      if (!user?.email) {
        setProfile(null)
        return
      }

      const { data } = await supabase
        .from('users')
        .select('name, email, role')
        .eq('auth_user_id', user.id)
        .order('id', { ascending: true })
        .limit(1)

      if (!mounted) return
      setProfile(data?.[0] || null)
    }

    loadUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null)
      if (!session?.user) {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const signedInName = useMemo(() => getDisplayName(profile, authUser), [profile, authUser])
  const isSignedIn = Boolean(authUser)
  const isStudent=profile?.role==='student'

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    window.location.href = isStudent?'/student-login':'/login'
  }

  return (
    <header className="vicHeader">
      <a className="brand" href="/">
        <div className="brandMark">
          <VICLogo size={56} variant="header" />
        </div>
        <div>
          <div className="brandTitle">VIC</div>
          <div className="brandSub">Virtual Co-Teacher</div>
        </div>
      </a>

      <div className="userArea">
        {statusLabel ? (
          <div className={`headerStatus ${statusTone === 'thinking' ? 'thinking' : 'ready'}`}>
            <span className="headerStatusDot" />
            <span>{statusLabel}</span>
          </div>
        ) : null}
        {isSignedIn ? (
          <>
            <div className="signedInName" title={signedInName}>
              {signedInName || 'Signed in'}
            </div>
            <button type="button" className="logoutButton" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </>
        ) : (
          <>
            <a className="authPrompt" href="/login">Educator log in</a>
            <a className="authPrompt" href="/student-login">Student log in</a>
            <a className="authPrompt signupPrompt" href="/signup">Sign up — it’s free</a>
          </>
        )}
      </div>

      <div className="navigationRow">
      <nav className="navLinks" aria-label="Primary">
        {(isStudent?NAV_ITEMS.filter(item=>['/','/askvic'].includes(item.href)):NAV_ITEMS).map((item) => {
          const isPrimary = PRIMARY_PATHS.has(item.href)
          const classes = [
            'navLink',
            isPrimary ? 'primaryLink' : 'secondaryLink',
            (currentPath === item.href || (currentPath === '/assistantprincipal' && item.href === '/educatorassistant')) ? 'active' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <a key={item.href} href={item.href} className={classes}>
              {item.label}
            </a>
          )
        })}
      </nav>

        {!isStudent && <nav className="workspaceLinks" aria-label="Educator dashboard"><a href="/educator" aria-current={currentPath==='/educator'?'page':undefined}>Educator Dashboard →</a></nav>}
      </div>

      <style jsx>{`
        .vicHeader {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 12px;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 14px;
          background: var(--vic-surface);
          border: 1px solid var(--vic-border-soft);
          box-shadow: var(--vic-shadow-card);
          margin-bottom: 6px;
          flex-wrap: nowrap;
        }
        .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--vic-text-primary); flex-shrink: 0; }
        .brandMark {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .brandTitle { font-size: 20px; font-weight: 900; letter-spacing: 0.01em; line-height: 1; }
        .brandSub { font-size: 11px; color: var(--vic-text-secondary); font-weight: 700; line-height: 1.1; }
        .navLinks { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .navLink { color: var(--vic-text-secondary); text-decoration: none; font-size: 13px; padding: 7px 10px; border-radius: 9px; border: 1px solid transparent; transition: color .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease; font-weight: 800; }
        .primaryLink { color: var(--vic-text-primary); }
        .navLink:hover { border-color: rgba(181, 83, 47, 0.42); color: var(--vic-primary); background: var(--vic-surface-muted); }
        .active { background: var(--vic-primary); border-color: var(--vic-primary); color: var(--vic-surface); box-shadow: 0 10px 20px rgba(150,69,40,0.28); }
        .userArea { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-left: auto; }
        .headerStatus {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--vic-border-soft);
          background: var(--vic-surface-muted);
          font-size: 11px;
          font-weight: 800;
          color: var(--vic-text-primary);
        }
        .headerStatus.ready .headerStatusDot {
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.48);
        }
        .headerStatus.thinking .headerStatusDot {
          background: #f59e0b;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.45);
        }
        .headerStatusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .signedInName { max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--vic-text-secondary); font-weight: 700; }
        .logoutButton, .authPrompt { color: var(--vic-text-primary); text-decoration: none; border: 1px solid var(--vic-border); background: var(--vic-surface); border-radius: 9px; padding: 7px 10px; font-size: 12px; font-weight: 800; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
        .logoutButton:hover, .authPrompt:hover { background: var(--vic-surface-muted); border-color: rgba(181, 83, 47, 0.34); }
        .signupPrompt { background: var(--vic-primary); color: white; border-color: var(--vic-primary); white-space: nowrap; }
        .signupPrompt:hover { background: var(--vic-primary-hover, var(--vic-primary)); color: white; }
        .logoutButton:disabled { opacity: 0.7; cursor: default; }
        .vicHeader{padding:16px 20px;border-radius:18px;box-shadow:none;gap:16px}
        .userArea{justify-content:flex-end;margin-left:0}
        .navigationRow{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid var(--vic-border-soft);padding-top:12px}
        .navLinks{gap:5px;flex-wrap:nowrap}
        .navLink{font-size:12px;padding:8px 10px;white-space:nowrap}
        .active{background:var(--vic-surface-muted);color:var(--vic-primary);box-shadow:none;border-color:var(--vic-border-soft)}
        .workspaceLinks{display:flex;align-items:center;gap:14px;padding-left:20px;border-left:1px solid var(--vic-border-soft)}
        .workspaceLinks span{font-size:8px;font-weight:800;letter-spacing:.08em;color:var(--vic-text-secondary)}
        .workspaceLinks a{font-size:11px;font-weight:700;color:var(--vic-text-secondary);white-space:nowrap;text-decoration:none}
        .workspaceLinks a:hover{text-decoration:underline;color:var(--vic-primary)}
        @media(max-width:1100px){.workspaceLinks span{display:none}.navigationRow{gap:10px}.workspaceLinks{gap:10px;padding-left:12px}}
        @media(max-width:800px){.vicHeader{padding:12px;gap:12px}.brandSub{display:none}.navigationRow{flex-direction:column;align-items:flex-start}.navLinks{flex-wrap:wrap}.workspaceLinks{padding:10px 0 0;border-left:0;border-top:1px solid var(--vic-border-soft);width:100%;flex-wrap:wrap}.workspaceLinks span{display:inline}.authPrompt,.logoutButton{font-size:10px;padding:7px}.userArea{gap:5px}.signedInName{max-width:115px}}
        @media(max-width:420px){.vicHeader{grid-template-columns:1fr}.userArea{justify-content:flex-start}.brandSub{display:block}.brandTitle{font-size:18px}.navLink{font-size:11px;padding:7px 8px}}
      `}</style>
    </header>
  )
}
