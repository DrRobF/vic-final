import { useState } from 'react'

export default function AskVIC() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [scratchPad, setScratchPad] = useState('')
  const [notes, setNotes] = useState('')
  const [showCalculator, setShowCalculator] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')

  async function sendMessage() {
    if (!message.trim() || loading) return

    setLoading(true)
    setReply('VIC is thinking...')

    try {
      const res = await fetch('/api/vic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      const data = await res.json()
      setReply(data.reply || 'No reply')
    } catch (error) {
      setReply('Something went wrong. Please try again.')
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

  function chooseSubject(subject) {
    setMessage(`I need help with ${subject}. Please teach me step by step.`)
  }

  function runCalculator() {
    try {
      const safe = calcInput.replace(/[^0-9+\-*/(). ]/g, '')
      const result = Function(`"use strict"; return (${safe})`)()
      setCalcResult(String(result))
    } catch {
      setCalcResult('Invalid calculation')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.brandRow}>
            <div style={styles.logo}>V</div>
            <div>
              <div style={styles.eyebrow}>AI TEACHER</div>
              <div style={styles.brandName}>VIC</div>
            </div>
          </div>

          <h1 style={styles.heading}>More than answers. Real teaching.</h1>

          <p style={styles.subheading}>
            VIC helps students with support, practice, enrichment, and evening help
            in a calm, guided workspace.
          </p>

          <div style={styles.card}>
            <div style={styles.cardTitle}>Scratch Pad</div>
            <textarea
              value={scratchPad}
              onChange={(e) => setScratchPad(e.target.value)}
              placeholder="Work things out here..."
              style={styles.sideTextarea}
            />
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.chatCard}>
            <div style={styles.chatHeader}>
              <div>
                <div style={styles.chatLabel}>GUIDED SESSION</div>
                <div style={styles.chatTitle}>Start with VIC</div>
              </div>
              <div style={styles.statusPill}>
                <span style={styles.statusDot} />
                Ready to teach
              </div>
            </div>

            <div style={styles.messageArea}>
              <div style={styles.assistantBubble}>
                <div style={styles.bubbleLabel}>VIC</div>
                <p style={styles.bubbleText}>
                  I’m here to teach, not just answer. Choose a subject or tell me what
                  you’re working on.
                </p>
              </div>

              {message.trim() ? (
                <div style={styles.userBubble}>
                  <div style={styles.bubbleLabelUser}>YOU</div>
                  <p style={styles.bubbleText}>{message}</p>
                </div>
              ) : null}

              {reply ? (
                <div style={styles.assistantBubble}>
                  <div style={styles.bubbleLabel}>VIC</div>
                  <p style={styles.bubbleText}>{reply}</p>
                </div>
              ) : null}
            </div>

            <div style={styles.subjectSection}>
              <div style={styles.sectionTitle}>Choose a subject</div>
              <div style={styles.subjectGrid}>
                <button style={styles.subjectButton} onClick={() => chooseSubject('math')}>
                  Math
                </button>
                <button style={styles.subjectButton} onClick={() => chooseSubject('reading')}>
                  Reading
                </button>
                <button style={styles.subjectButton} onClick={() => chooseSubject('writing')}>
                  Writing
                </button>
                <button style={styles.subjectButton} onClick={() => chooseSubject('science')}>
                  Science
                </button>
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
                <div style={styles.cardTitle}>Calculator</div>
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
                <div style={styles.cardTitle}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keep notes here..."
                  style={styles.notesTextarea}
                />
              </div>
            ) : null}

            <div style={styles.inputSection}>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Type what you need help with..."
                style={styles.mainTextarea}
              />

              <div style={styles.inputFooter}>
                <div style={styles.inputHint}>Press Enter to send</div>
                <button
                  onClick={sendMessage}
                  disabled={loading || !message.trim()}
                  style={{
                    ...styles.sendButton,
                    opacity: loading || !message.trim() ? 0.6 : 1,
                    cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Teaching...' : 'Start'}
                </button>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },

  glowOne: {
    position: 'absolute',
    top: '-120px',
    left: '-80px',
    width: '320px',
    height: '320px',
    background: 'rgba(84, 119, 255, 0.16)',
    filter: 'blur(90px)',
    borderRadius: '50%',
  },

  glowTwo: {
    position: 'absolute',
    bottom: '-120px',
    right: '-60px',
    width: '320px',
    height: '320px',
    background: 'rgba(70, 220, 190, 0.10)',
    filter: 'blur(90px)',
    borderRadius: '50%',
  },

  shell: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '40px 24px',
    display: 'grid',
    gridTemplateColumns: '0.85fr 1.15fr',
    gap: '28px',
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
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #7aa2ff 0%, #5eead4 100%)',
    color: '#08111f',
    fontWeight: 700,
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyebrow: {
    fontSize: '11px',
    letterSpacing: '0.18em',
    color: '#8ea3d1',
    fontWeight: 700,
  },

  brandName: {
    fontSize: '20px',
    fontWeight: 700,
    marginTop: '3px',
  },

  heading: {
    fontSize: '50px',
    lineHeight: 1.02,
    margin: 0,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    maxWidth: '500px',
  },

  subheading: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: '#b8c6e6',
    maxWidth: '500px',
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
    marginBottom: '12px',
    color: '#f3f7ff',
  },

  sideTextarea: {
    width: '100%',
    minHeight: '300px',
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

  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#d7e3ff',
  },

  statusDot: {
    width: '8px',
    height: '8px',
    background: '#5eead4',
    borderRadius: '50%',
  },

  messageArea: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '16px',
    minHeight: '170px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '18px',
    padding: '16px 18px',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    background: 'linear-gradient(135deg, rgba(122,162,255,0.20), rgba(94,234,212,0.12))',
    border: '1px solid rgba(122,162,255,0.20)',
    borderRadius: '18px',
    padding: '16px 18px',
  },

  bubbleLabel: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#8ea3d1',
    fontWeight: 700,
    marginBottom: '8px',
  },

  bubbleLabelUser: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#b8fff1',
    fontWeight: 700,
    marginBottom: '8px',
  },

  bubbleText: {
    margin: 0,
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#edf3ff',
    whiteSpace: 'pre-wrap',
  },

  subjectSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#cdd9f5',
  },

  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },

  subjectButton: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#e8eefc',
    padding: '16px',
    borderRadius: '16px',
    fontSize: '15px',
    fontWeight: 600,
    textAlign: 'left',
  },

  toolsBar: {
    display: 'flex',
    gap: '10px',
  },

  toolButton: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#dfe8fb',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
  },

  toolPanel: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    padding: '16px',
  },

  calcInput: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#eef4ff',
    padding: '12px',
    fontSize: '15px',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },

  calcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
    color: '#dbe6ff',
  },

  notesTextarea: {
    width: '100%',
    minHeight: '120px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#eef4ff',
    padding: '14px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    boxSizing: 'border-box',
  },

  inputSection: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '20px',
    padding: '16px',
  },

  mainTextarea: {
    width: '100%',
    minHeight: '130px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.08)',
    color: '#eef4ff',
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
    color: '#90a3c8',
  },

  sendButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '14px 22px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#07111e',
    background: 'linear-gradient(135deg, #7aa2ff 0%, #5eead4 100%)',
  },
}
