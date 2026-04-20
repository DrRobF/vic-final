import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function StudentPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/askvic')
  }, [router])

  return (
    <main style={{ padding: '32px 16px', color: 'var(--vic-surface)' }}>
      Redirecting to Ask VIC...
    </main>
  )
}
