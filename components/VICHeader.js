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

export default function VICHeader({ currentPath = '' }) {
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
        <img src="/vic-logo.png" alt="VIC logo" />
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
          gap: 22px;
          justify-content: space-between;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(11, 12, 20, 0.78);
          backdrop-filter: blur(14px);
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: #fff;
          flex-shrink: 0;
        }
        .brand img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
        }
        .brandTitle {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .brandSub {
          font-size: 11px;
          opacity: 0.75;
        }
        .navLinks {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .navLink {
          color: rgba(233, 237, 255, 0.88);
          text-decoration: none;
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid transparent;
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .primaryLink {
          font-weight: 700;
        }
        .secondaryLink {
          font-weight: 600;
          opacity: 0.88;
        }
        .navLink:hover {
          border-color: rgba(133, 153, 255, 0.55);
          color: #fff;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .active {
          background: rgba(115, 109, 255, 0.22);
          border-color: rgba(133, 153, 255, 0.5);
          color: #fff;
          opacity: 1;
        }
        .userArea {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }
        .signedInName {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          color: #d7ddff;
        }
        .logoutButton,
        .authPrompt {
          color: #fff;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.24);
          background: rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .logoutButton:hover,
        .authPrompt:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.32);
        }
        .logoutButton:disabled {
          opacity: 0.7;
          cursor: default;
        }
        @media (max-width: 980px) {
          .vicHeader {
            padding: 12px 14px;
            gap: 14px;
          }
          .userArea {
            margin-left: 0;
          }
        }
      `}</style>
    </header>
  )
}
