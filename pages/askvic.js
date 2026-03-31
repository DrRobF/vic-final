import { useEffect, useMemo, useRef, useState } from 'react'

const BRAIN_VERSION = 'v3.2.2'

export default function AskVIC() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workArea, setWorkArea] = useState('')
  const [notes, setNotes] = useState('')
  const [showCalculator, setShowCalculator] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi — pick a subject on the left or type here to begin.',
      visual: { type: 'placeholder' },
    },
  ])

  const messageAreaRef = useRef(null)

  const canGetReport = useMemo(
    () => messages.length > 1 && !loading,
    [messages.length, loading]
  )

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function sendMessage(customMessage) {
    const outgoing = typeof customMessage === 'string' ? customMessage : input
    if (!outgoing.trim() || loading) return

    const next = [...messages, { role: 'user', text: outgoing }]

    setMessages([...next, { role: 'assistant', text: 'Thinking...' }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/vic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.text })),
        }),
      })

      const data = await res.json()

      setMessages([
        ...next,
        {
          role: 'assistant',
          text: data.reply || 'No reply',
          visual: inferVisual(data.reply),
        },
      ])
    } catch {
      setMessages([
        ...next,
        { role: 'assistant', text: 'Something went wrong.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function startSubject(subject) {
    sendMessage(`Start a ${subject} lesson.`)
  }

  function requestReport() {
    sendMessage('Generate a session report.')
  }

  return (
    <div style={styles.page}>
      <div style={styles.layout}>

        {/* LEFT PANEL */}
        <div style={styles.left}>

          {/* LOGO */}
          <div style={styles.logoBox}>
            <img src="/vic-logo.png" style={{ width: '100%' }} />
            <div style={styles.version}>Brain {BRAIN_VERSION}</div>
          </div>

          {/* START BUTTONS */}
          <div style={styles.card}>
            <div style={styles.title}>Start Learning</div>
            <div style={styles.grid}>
              <button onClick={() => startSubject('math')}>Math</button>
              <button onClick={() => startSubject('reading')}>Reading</button>
              <button onClick={() => startSubject('writing')}>Writing</button>
              <button onClick={() => startSubject('science')}>Science</button>
            </div>
          </div>

          {/* TOOLS */}
          <div style={styles.card}>
            <div style={styles.title}>Tools</div>

            <button onClick={() => setShowCalculator(!showCalculator)}>
              Calculator
            </button>

            <button onClick={() => setShowNotes(!showNotes)}>
              Notes
            </button>

            <button disabled={!canGetReport} onClick={requestReport}>
              Get Report
            </button>

            {showCalculator && (
              <div>
                <input
                  value={calcInput}
                  onChange={e => setCalcInput(e.target.value)}
                  placeholder="12 * (4+3)"
                />
                <button onClick={() => setCalcResult(eval(calcInput))}>
                  =
                </button>
                <div>{calcResult}</div>
              </div>
            )}

            {showNotes && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            )}
          </div>

          {/* PRACTICE */}
          <div style={styles.card}>
            <div style={styles.title}>Practice Area</div>
            <textarea
              value={workArea}
              onChange={e => setWorkArea(e.target.value)}
              placeholder="Let’s practice..."
            />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={styles.right}>

          <div style={styles.chat}>

            {/* CHAT MESSAGES */}
            <div ref={messageAreaRef} style={styles.messages}>
              {messages.map((m, i) => (
                <div key={i} style={m.role === 'assistant' ? styles.bot : styles.user}>
                  {m.text}
                  {m.visual && <Visual visual={m.visual} />}
                </div>
              ))}
            </div>

            {/* INPUT */}
            <div style={styles.inputBox}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type here..."
              />

              <button onClick={() => sendMessage()}>
                Send
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

/* ---------- VISUAL ---------- */

function Visual({ visual }) {
  if (visual.type === 'placeholder') {
    return <div style={{ marginTop: 10, opacity: 0.4 }}>Visual area</div>
  }
  return null
}

function inferVisual(text = '') {
  return { type: 'placeholder' }
}

/* ---------- STYLES ---------- */

const styles = {
  page: {
    height: '100vh',
    background: '#0b1224',
    color: 'white',
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    height: '100%',
  },

  left: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
  },

  right: {
    padding: 16,
    height: '100%',
  },

  logoBox: {
    background: '#111827',
    padding: 12,
    borderRadius: 12,
  },

  version: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 6,
  },

  card: {
    background: '#111827',
    padding: 12,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  title: {
    fontWeight: 'bold',
    marginBottom: 6,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },

  chat: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },

  messages: {
    flex: 1,
    overflowY: 'auto',
    background: 'white',
    color: 'black',
    padding: 12,
    borderRadius: 12,
  },

  bot: {
    marginBottom: 10,
  },

  user: {
    textAlign: 'right',
    marginBottom: 10,
  },

  inputBox: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
}
