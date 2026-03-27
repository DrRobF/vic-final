import { useState } from 'react'

export default function AskVIC() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)

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

  function usePrompt(prompt) {
    setMessage(prompt)
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.brandRow}>
            <div style={styles.logo}>V</div>
            <div>
              <div style={styles.eyebrow}>AI TUTOR</div>
              <div style={styles.brandName}>VIC</div>
            </div>
          </div>

          <h1 style={styles.heading}>Ask better. Learn faster.</h1>

          <p style={styles.subheading}>
            VIC helps students think clearly, practice confidently, and get
            unstuck without the pressure of a classroom.
          </p>

          <div style={styles.promptGrid}>
            <button style={styles.promptButton} onClick={() => usePrompt('Help me with fractions')}>
              Help me with fractions
            </button>
            <button style={styles.promptButton} onClick={() => usePrompt('Quiz me on vocabulary')}>
              Quiz me on vocabulary
            </button>
            <button style={styles.promptButton} onClick={() => usePrompt('Explain this step by step')}>
              Explain this step by step
            </button>
            <button style={styles.promptButton} onClick={() => usePrompt('I need help getting started')}>
              I need help getting started
            </button>
          </div>

          <div style={styles.infoRow}>
            <div style={styles.infoCard}>
              <div style={styles.infoTitle}>Student-friendly</div>
              <div style={styles.infoText}>Clear explanations without overwhelm.</div>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.infoTitle}>Calm support</div>
              <div style={styles.infoText}>Built to guide, not intimidate.</div>
            </div>
          </div>
        </div>

        <div style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <div>
              <div style={styles.chatLabel}>LIVE SESSION</div>
              <div style={styles.chatTitle}>Ask VIC</div>
            </div>
            <div style={styles.statusWrap}>
              <span style={styles.statusDot} />
              <span style={styles.statusText}>Ready</span>
            </div>
          </div>

          <div style={styles.chatBody}>
            <div style={styles.assistantBubble}>
              <div style={styles.bubbleLabel}>VIC</div>
              <p style={styles.bubbleText}>
                Hi — tell me what you’re working on, what grade you’re in, or
                where you want to jump in.
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

          <div style={styles.inputWrap}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              style={styles.textarea}
              placeholder="Ask a question, paste a problem, or tell VIC what you need help with..."
            />

            <div style={styles.inputFooter}>
              <div style={styles.inputHint}>Press Enter to send · Shift+Enter for a new line</div>

              <button
                onClick={sendMessage}
                disabled={loading || !message.trim()}
                style={{
                  ...styles.sendButton,
                  opacity: loading || !message.trim() ? 0.6 : 1,
                  cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Thinking...' : 'Send'}
              </button>
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
    padding: '48px 24px',
    display: 'grid',
    gridTemplateColumns: '1fr 1.1fr',
    gap: '28px',
    alignItems: 'stretch',
  },

  leftPanel: {
    padding: '24px 8px 24px 8px',
  },

  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '28px',
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
    boxShadow: '0 10px 30px rgba(94, 234, 212, 0.20)',
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
    fontSize: '56px',
    lineHeight: 1.02,
    margin: '0 0 18px 0',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    maxWidth: '540px',
  },

  subheading: {
    fontSize: '19px',
    lineHeight: 1.65,
    color: '#b8c6e6',
    maxWidth: '560px',
    margin: '0 0 28px 0',
  },

  promptGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '26px',
  },

  promptButton: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#e8eefc',
    padding: '14px 16px',
    borderRadius: '16px',
    textAlign: 'left',
    fontSize: '15px',
    lineHeight: 1.4,
    backdropFilter: 'blur(10px)',
  },

  infoRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },

  infoCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    padding: '18px',
    backdropFilter: 'blur(10px)',
  },

  infoTitle: {
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#f3f7ff',
  },

  infoText: {
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#b8c6e6',
  },

  chatPanel: {
    background: 'rgba(12, 19, 35, 0.72)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '28px',
    padding: '20px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '760px',
  },

  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '18px',
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
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
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

  chatBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '10px 2px 18px 2px',
    overflowY: 'auto',
  },

  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '20px',
    padding: '16px 18px',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    background: 'linear-gradient(135deg, rgba(122,162,255,0.20), rgba(94,234,212,0.12))',
    border: '1px solid rgba(122,162,255,0.20)',
    borderRadius: '20px',
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

  inputWrap: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: '18px',
  },

  textarea: {
    width: '100%',
    minHeight: '140px',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#eef4ff',
    padding: '18px',
    fontSize: '16px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  inputFooter: {
    marginTop: '14px',
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
    boxShadow: '0 10px 30px rgba(94, 234, 212, 0.20)',
  },
}
