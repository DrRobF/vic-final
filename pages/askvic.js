import { useEffect, useRef, useState } from 'react'

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
      text: 'I’m here to teach, not just answer. Type anything to begin or start a lesson below.',
    },
  ])

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

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
            <div style={styles.logoWrap}>
              <div style={styles.logoCore}>
                <span style={styles.logoText}>VC</span>
                <div style={styles.logoShine} />
              </div>
            </div>

            <div style={styles.brandTextWrap}>
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

          <div style={styles.leftToolsWrap}>
            <div style={styles.leftToolsTitle}>Tools</div>

            <div style={styles.leftToolsBar}>
              <button
                style={styles.toolButton}
                onClick={() => setShowCalculator(!showCalculator)}
              >
                Calculator
              </button>
              <button
                style={styles.toolButton}
                onClick={() => setShowNotes(!showNotes)}
              >
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
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 1 ? (
                <div style={styles.helperText}>
                  Type anything to begin, or start a lesson below.
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
    overflowX: 'hidden',
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
    padding: '96px 24px 32px',
    display: 'grid',
    gridTemplateColumns: '0.9fr 1.1fr',
    gap: '28px',
    alignItems: 'start',
  },

  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    paddingTop: '12px',
  },

  rightPanel: {
    display: 'flex',
    paddingTop: '12px',
  },

  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '8px',
  },

  logoWrap: {
    position: 'relative',
    flexShrink: 0,
  },

  logoCore: {
    position: 'relative',
    width: '82px',
    height: '82px',
    borderRadius: '24px',
    background: 'linear-gradient(145deg, #7ea2ff 0%, #58dfd1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow:
      '0 18px 42px rgba(79,209,197,0.22), inset 0 1px 0 rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },

  logoText: {
    position: 'relative',
    zIndex: 2,
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '0.08em',
    color: '#08111f',
  },

  logoShine: {
    position: 'absolute',
    top: '-18px',
    right: '-12px',
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.24)',
    filter: 'blur(6px)',
  },

  brandTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },

  brandName: {
    fontSize: '34px',
    fontWeight: 900,
    letterSpacing: '0.04em',
    lineHeight: 1,
    marginBottom: '8px',
  },

  tagline: {
    fontSize: '14px',
    color: '#8ea3d1',
    letterSpacing: '0.08em',
    fontWeight: 600,
  },

  heading: {
    fontSize: '54px',
    lineHeight: 1.02,
    margin: 0,
    marginBottom: '8px',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    maxWidth: '560px',
  },

  taglinePrimary: {
    fontSize: '20px',
    lineHeight: 1.55,
    color: '#dbe6ff',
    maxWidth: '540px',
    margin: 0,
    marginBottom: '8px',
    fontWeight: 500,
  },

  subheading: {
    fontSize: '19px',
    lineHeight: 1.6,
    color: '#b8c6e6',
    maxWidth: '540px',
    margin: 0,
  },

  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '16px',
  },

  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#f3f7ff',
  },

  cardHelper: {
    fontSize: '13px',
    lineHeight: 1.45,
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
    minHeight: '250px',
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

  leftToolsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  leftToolsTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d7e3ff',
  },

  leftToolsBar: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },

  chatCard: {
    width: '100%',
    background: 'rgba(12, 19, 35, 0.72)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  chatLabel: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#8ea3d1',
    fontWeight: 700,
  },

  chatTitle: {
    fontSize: '26px',
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
    padding: '16px',
    background:
      'linear-gradient(135deg, rgba(98,132,255,0.18), rgba(94,234,212,0.10))',
    border: '1px solid rgba(130, 154, 255, 0.35)',
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 28px rgba(94,234,212,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  messageArea: {
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '20px',
    padding: '16px',
    minHeight: '220px',
    maxHeight: '360px',
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
    padding: '14px 16px',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    background: '#e8f1ff',
    border: '1px solid #c6dafd',
    borderRadius: '18px',
    padding: '14px 16px',
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
    padding: '12px',
  },

  mainTextarea: {
    width: '100%',
    minHeight: '72px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.96)',
    color: '#0f172a',
    padding: '14px',
    fontSize: '16px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  inputFooter: {
    marginTop: '10px',
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
    padding: '12px 20px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#07111e',
    background: 'linear-gradient(135deg, #7aa2ff 0%, #5eead4 100%)',
    boxShadow: '0 10px 30px rgba(94, 234, 212, 0.20)',
  },

  subjectSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d7e3ff',
  },

  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  subjectButton: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#f7fbff',
    padding: '14px',
    borderRadius: '16px',
    fontSize: '15px',
    fontWeight: 600,
    textAlign: 'left',
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
