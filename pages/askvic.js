import { useState } from 'react'

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
      text: 'I’m here to teach, not just answer. Type anything to begin or start a subject below.',
    },
  ])

  async function sendMessage(customMessage) {
    const outgoing = typeof customMessage === 'string' ? customMessage : input

    if (!outgoing.trim() || loading) return

    const userMessage = { role: 'user', text: outgoing }
    const thinkingMessage = { role: 'assistant', text: 'VIC is thinking...' }

    setMessages((prev) => [...prev, userMessage, thinkingMessage])
    setLoading(true)
    setInput('')

    try {
      const res = await fetch('/api/vic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: outgoing }),
      })

      const data = await res.json()
      const finalReply = data.reply || 'No reply'

      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', text: finalReply }
        return updated
      })
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          text: 'Something went wrong. Please try again.',
        }
        return updated
      })
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
    const subjectMessage = `I want to start a ${subject} lesson. Please guide me step by step.`
    sendMessage(subjectMessage)
  }

  function runCalculator() {
    try {
      const safe = calcInput.replace(/[^0-9+\-*/(). ]/g, '')
      if (!safe.trim()) {
        setCalcResult('')
        return
      }
      const result = Function(`"use strict"; return (${safe})`)()
      setCalcResult(String(result))
    } catch {
      setCalcResult('Invalid calculation')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.brandRow}>
            <div style={styles.logo}>VIC</div>

            <div>
              <div style={styles.brandName}>VIC</div>
              <div style={styles.tagline}>Virtual Co-Teacher</div>
            </div>
          </div>

          <h1 style={styles.heading}>More than answers. Real teaching.</h1>

          <p style={styles.taglinePrimary}>
            A guided learning environment with an intelligent co-teacher.
          </p>

          <p style={styles.subheading}>
            VIC helps students with support, practice, enrichment, and evening help
            in a calm, guided workspace.
          </p>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Work Area</div>
            <div style={styles.cardHelper}>Write your work here while VIC helps you.</div>
            <textarea
              value={workArea}
              onChange={(e) => setWorkArea(e.target.value)}
              placeholder="Show your work here..."
              style={styles.sideTextarea}
            />
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.chatCard}>
            <div style={styles.chatHeader}>
              <div>
                <div style={styles.chatLabel}>GUIDED SESSION</div>
                <div style={styles.chatTitle}>Learning Session</div>
              </div>

              <div style={styles.statusWrap}>
                <span style={styles.statusDot} />
                <span style={styles.statusText}>Ready</span>
              </div>
            </div>

            <div style={styles.systemWrap}>
              <div style={styles.messageArea}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={msg.role === 'assistant' ? styles.assistantBubble : styles.userBubble}
                  >
                    <div
                      style={
                        msg.role === 'assistant' ? styles.bubbleLabel : styles.bubbleLabelUser
                      }
                    >
                      {msg.role === 'assistant' ? 'VIC' : 'YOU'}
                    </div>
                    <p
                      style={
                        msg.role === 'assistant' ? styles.bubbleText : styles.userBubbleText
                      }
                    >
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>

              {messages.length === 1 ? (
                <div style={styles.helperText}>
                  Type anything to begin (like “help me with fractions”) or start a lesson below.
                </div>
              ) : null}

              <div style={styles.inputSection}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Type what you need help with..."
                  style={styles.mainTextarea}
                />

                <div style={styles.inputFooter}>
                  <div style={styles.inputHint}>Press Enter to send</div>
                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    style={{
                      ...styles.sendButton,
                      opacity: loading || !input.trim() ? 0.6 : 1,
                      cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Thinking...' : 'Send'}
                  </button>
                </div>
              </div>

              <div style={styles.subjectSection}>
                <div style={styles.sectionTitle}>Start a lesson</div>
                <div style={styles.subjectGrid}>
                  <button style={styles.subjectButton} onClick={() => startSubject('math')}>
                    Start Math
                  </button>
                  <button style={styles.subjectButton} onClick={() => startSubject('reading')}>
                    Start Reading
                  </button>
                  <button style={styles.subjectButton} onClick={() => startSubject('writing')}>
                    Start Writing
                  </button>
                  <button style={styles.subjectButton} onClick={() => startSubject('science')}>
                    Start Science
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.toolsBar}>
              <button style={styles.toolButton} onClick={() => setShowCalculator(!showCalculator)}>
                Calculator
              </button>
              <button style={styles.toolButton} onClick={() => setShowNotes(!showNotes)}>
                Notes
              </button>
            </div>

            {showCalculator ? (
              <div style={styles.toolPanel}>
                <div style={styles.cardTitleDark}>Calculator</div>
                <input
                  value={calcInput}
                  onChange={(e) => setCalcInput(e.target.value)}
                  placeholder="Example: 12 * (4 + 3)"
                  style={styles.calcInput}
                />
                <div style={styles.calcRow}>
                  <button style={styles.smallButton} onClick={runCalculator}>
                    Calculate
                  </button>
                  <div style={styles.calcResult}>{calcResult}</div>
                </div>
              </div>
            ) : null}

            {showNotes ? (
              <div style={styles.toolPanel}>
                <div style={styles.cardTitleDark}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keep notes here..."
                  style={styles.notesTextarea}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, rgba(72,118,255,0.16), transparent 32%), radial-gradient(circle at bottom right, rgba(87,224,184,0.10), transparent 30%), linear-gradient(135deg, #0a1020 0%, #0f172a 45%, #121826 100%)',
    color: '#e8eefc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },

  backgroundGlowOne: {
    position: 'absolute',
    top: '-120px',
    left: '-80px',
    width: '320px',
    height: '320px',
    background: 'rgba(84, 119, 255, 0.16)',
    filter: 'blur(90px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowTwo: {
    position: 'absolute',
    bottom: '-120px',
    right: '-60px',
    width: '320px',
    height: '320px',
    background: 'rgba(70, 220, 190, 0.10)',
    filter: 'blur(90px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  shell: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '40px 24px',
    display: 'grid',
    gridTemplateColumns: '0.92fr 1.08fr',
    gap: '28px',
    alignItems: 'stretch',
  },

  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  rightPanel: {
    display: 'flex',
  },

  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },

  logo: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #6f8cff 0%, #4fd1c5 100%)',
    color: '#0a1020',
    fontWeight: 800,
    fontSize: '19px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: '1px',
    boxShadow: '0 12px 30px rgba(79, 209, 197, 0.25)',
  },

  brandName: {
    fontSize: '30px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    lineHeight: 1,
    marginBottom: '6px',
  },

  tagline: {
    fontSize: '13px',
    color: '#8ea3d1',
    letterSpacing: '0.08em',
    fontWeight: 600,
  },

  heading: {
    fontSize: '50px',
    lineHeight: 1.02,
    margin: 0,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    maxWidth: '520px',
  },

  taglinePrimary: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: '#dbe6ff',
    maxWidth: '520px',
    margin: 0,
    fontWeight: 500,
  },

  subheading: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: '#b8c6e6',
    maxWidth: '520px',
    margin: 0,
  },

  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '18px',
  },

  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#f3f7ff',
  },

  cardHelper: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#9fb0d3',
    marginBottom: '12px',
  },

  cardTitleDark: {
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '12px',
    color: '#0f172a',
  },

  sideTextarea: {
    width: '100%',
    minHeight: '320px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#eef4ff',
    padding: '16px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  chatCard: {
    width: '100%',
    background: 'rgba(12, 19, 35, 0.72)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '28px',
    padding: '20px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '14px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  chatLabel: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#8ea3d1',
    fontWeight: 700,
  },

  chatTitle: {
    fontSize: '28px',
    fontWeight: 800,
    marginTop: '6px',
  },

  statusWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '999px',
    padding: '8px 12px',
  },

  statusDot: {
    width: '8px',
    height: '8px',
    background: '#5eead4',
    borderRadius: '50%',
    boxShadow: '0 0 12px rgba(94, 234, 212, 0.7)',
  },

  statusText: {
    fontSize: '13px',
    color: '#d7e3ff',
  },

  systemWrap: {
    borderRadius: '24px',
    padding: '18px',
    background:
      'linear-gradient(135deg, rgba(98,132,255,0.18), rgba(94,234,212,0.10))',
    border: '1px solid rgba(130, 154, 255, 0.35)',
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 28px rgba(94,234,212,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  messageArea: {
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '20px',
    padding: '16px',
    minHeight: '260px',
    maxHeight: '420px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },

  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    background: '#f3f7fb',
    border: '1px solid #d8e2ee',
    borderRadius: '18px',
    padding: '16px 18px',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    background: '#e8f1ff',
    border: '1px solid #c6dafd',
    borderRadius: '18px',
    padding: '16px 18px',
  },

  bubbleLabel: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#5f7290',
    fontWeight: 700,
    marginBottom: '8px',
  },

  bubbleLabelUser: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#355e9b',
    fontWeight: 700,
    marginBottom: '8px',
  },

  bubbleText: {
    margin: 0,
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#0f172a',
    whiteSpace: 'pre-wrap',
  },

  userBubbleText: {
    margin: 0,
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#0f172a',
    whiteSpace: 'pre-wrap',
  },

  helperText: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#d7e3ff',
    textAlign: 'center',
  },

  inputSection: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '18px',
    padding: '14px',
  },

  mainTextarea: {
    width: '100%',
    minHeight: '84px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.96)',
    color: '#0f172a',
    padding: '16px',
    fontSize: '16px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  inputFooter: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },

  inputHint: {
    fontSize: '13px',
    color: '#d2def8',
  },

  sendButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '14px 22px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#07111e',
    background: 'linear-gradient(135deg, #7aa2ff 0%, #5eead4 100%)',
    boxShadow: '0 10px 30px rgba(94, 234, 212, 0.20)',
  },

  subjectSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d7e3ff',
  },

  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },

  subjectButton: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#f7fbff',
    padding: '16px',
    borderRadius: '16px',
    fontSize: '15px',
    fontWeight: 600,
    textAlign: 'left',
  },

  toolsBar: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  toolButton: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#eef4ff',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 600,
  },

  toolPanel: {
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '18px',
    padding: '16px',
  },

  calcInput: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid #d6e0ec',
    background: '#f8fbff',
    color: '#0f172a',
    padding: '12px',
    fontSize: '15px',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },

  calcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },

  smallButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#07111e',
    background: 'linear-gradient(135deg, #7aa2ff 0%, #5eead4 100%)',
  },

  calcResult: {
    fontSize: '14px',
    color: '#0f172a',
  },

  notesTextarea: {
    width: '100%',
    minHeight: '120px',
    borderRadius: '14px',
    border: '1px solid #d6e0ec',
    background: '#f8fbff',
    color: '#0f172a',
    padding: '14px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
}
