import { useState } from 'react'

export default function AskVIC() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [work, setWork] = useState('')
  const [notes, setNotes] = useState('')

  async function sendMessage(customMessage) {
    const outgoing = customMessage || message
    if (!outgoing.trim()) return

    setLoading(true)
    setMessage(outgoing)
    setReply('VIC is thinking...')

    try {
      const res = await fetch('/api/vic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: outgoing }),
      })

      const data = await res.json()
      setReply(data.reply || 'No reply')
    } catch {
      setReply('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function startSubject(subject) {
    const msg = `I want to start a ${subject} lesson. Please guide me step by step.`
    sendMessage(msg)
  }

  return (
    <div style={styles.page}>
      
      {/* TOP BAR */}
      <div style={styles.topBar}>
        <div style={styles.logo}>VIC</div>
        <div style={styles.status}>Ready</div>
      </div>

      {/* MAIN CHAT AREA */}
      <div style={styles.chatArea}>
        <div style={styles.assistantBubble}>
          VIC: I’ll guide you step by step. Choose a subject or tell me what you need help with.
        </div>

        {message && <div style={styles.userBubble}>You: {message}</div>}
        {reply && <div style={styles.assistantBubble}>{reply}</div>}
      </div>

      {/* HELPER TEXT */}
      {!message && (
        <div style={styles.helper}>
          Type anything to begin (like “help me with fractions”) or choose a subject below.
        </div>
      )}

      {/* SUBJECT BUTTONS */}
      <div style={styles.subjectRow}>
        <button onClick={() => startSubject('math')}>Start Math</button>
        <button onClick={() => startSubject('reading')}>Start Reading</button>
        <button onClick={() => startSubject('writing')}>Start Writing</button>
        <button onClick={() => startSubject('science')}>Start Science</button>
      </div>

      {/* INPUT */}
      <div style={styles.inputBar}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type what you need help with..."
          style={styles.input}
        />

        <button onClick={() => sendMessage()}>
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>

      {/* TOOLS BUTTON */}
      <div style={styles.toolsToggle}>
        <button onClick={() => setShowTools(!showTools)}>
          Tools
        </button>
      </div>

      {/* TOOLS PANEL */}
      {showTools && (
        <div style={styles.toolsPanel}>
          <div>
            <strong>Work Area</strong>
            <textarea
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder="Write your work here..."
            />
          </div>

          <div>
            <strong>Notes</strong>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes..."
            />
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    fontFamily: 'sans-serif',
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },

  logo: {
    fontWeight: 'bold',
    fontSize: '20px',
  },

  status: {
    fontSize: '14px',
    color: '#a5b4fc',
  },

  chatArea: {
    flex: 1,
    background: '#fff',
    color: '#000',
    borderRadius: '12px',
    padding: '15px',
    overflowY: 'auto',
    marginBottom: '10px',
  },

  assistantBubble: {
    marginBottom: '10px',
  },

  userBubble: {
    textAlign: 'right',
    marginBottom: '10px',
  },

  helper: {
    textAlign: 'center',
    fontSize: '14px',
    marginBottom: '10px',
    color: '#cbd5f5',
  },

  subjectRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginBottom: '10px',
  },

  inputBar: {
    display: 'flex',
    gap: '10px',
  },

  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
  },

  toolsToggle: {
    marginTop: '10px',
    textAlign: 'center',
  },

  toolsPanel: {
    marginTop: '10px',
    background: '#1e293b',
    padding: '10px',
    borderRadius: '10px',
  },
}
