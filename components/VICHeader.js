import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/askvic', label: 'Ask VIC' },
  { href: '/teacher', label: 'Teacher Portal' },
  { href: '/login', label: 'Log In' },
  { href: '/signup', label: 'Sign Up' },
]

const PRIMARY_PATHS = new Set(['/askvic', '/teacher'])

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
        .select('name, email')
        .eq('email', user.email)
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

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    window.location.href = '/login'
  }

  return (
    <header className="vicHeader">
      <a className="brand" href="/">
        <div className="brandMark">
          <img src="/vic-logo.png" alt="VIC logo" />
        </div>
        <div>
          <div className="brandTitle">VIC</div>
          <div className="brandSub">Virtual Co-Teacher</div>
        </div>
      </a>

      <nav className="navLinks" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isPrimary = PRIMARY_PATHS.has(item.href)
          const classes = [
            'navLink',
            isPrimary ? 'primaryLink' : 'secondaryLink',
            currentPath === item.href ? 'active' : '',
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
          <a className="authPrompt" href="/login">
            Sign in
          </a>
        )}
      </div>

      <style jsx>{`
        .vicHeader {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 24px;
          justify-content: space-between;
          padding: 18px 24px;
          border-radius: 18px;
          background: var(--vic-surface);
          border: 1px solid var(--vic-border-soft);
          box-shadow: var(--vic-shadow-card);
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--vic-text-primary); flex-shrink: 0; }
        .brandMark {
          width: 82px;
          height: 82px;
          border-radius: 20px;
          background: linear-gradient(160deg, #3f291f 0%, #6f3f29 60%, #8f5237 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 16px 30px rgba(43,36,31,0.28);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .brand img { width: 72px; height: 72px; border-radius: 16px; background: rgba(255,255,255,0.95); border: 1px solid rgba(232,216,200,0.9); padding: 5px; }
        .brandTitle { font-size: 24px; font-weight: 900; letter-spacing: 0.01em; }
        .brandSub { font-size: 13px; color: var(--vic-text-secondary); font-weight: 700; }
        .navLinks { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .navLink { color: var(--vic-text-secondary); text-decoration: none; font-size: 14px; padding: 10px 14px; border-radius: 10px; border: 1px solid transparent; transition: color .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease; font-weight: 800; }
        .primaryLink { color: var(--vic-text-primary); }
        .navLink:hover { border-color: rgba(181, 83, 47, 0.42); color: var(--vic-primary); background: var(--vic-surface-muted); }
        .active { background: var(--vic-primary); border-color: var(--vic-primary); color: var(--vic-surface); box-shadow: 0 10px 20px rgba(150,69,40,0.28); }
        .userArea { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .headerStatus {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--vic-border-soft);
          background: var(--vic-surface-muted);
          font-size: 12px;
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
        .signedInName { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--vic-text-secondary); font-weight: 700; }
        .logoutButton, .authPrompt { color: var(--vic-text-primary); text-decoration: none; border: 1px solid var(--vic-border); background: var(--vic-surface); border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 800; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
        .logoutButton:hover, .authPrompt:hover { background: var(--vic-surface-muted); border-color: rgba(181, 83, 47, 0.34); }
        .logoutButton:disabled { opacity: 0.7; cursor: default; }
        @media (max-width: 980px) {
          .vicHeader { padding: 14px; gap: 12px; }
          .brandMark { width: 74px; height: 74px; border-radius: 18px; }
          .brand img { width: 64px; height: 64px; border-radius: 14px; }
          .brandTitle { font-size: 21px; }
          .userArea { margin-left: 0; }
        }
      `}</style>
    </header>
  )
}
