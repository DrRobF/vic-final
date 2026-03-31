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
      text: 'Hi — pick a subject on the left to begin.',
      visual: { type: 'idle', title: 'Visual Support' },
    },
  ])

  const messageAreaRef = useRef(null)
  const previousMessageCountRef = useRef(messages.length)

  const canGetReport = useMemo(() => messages.length > 1 && !loading, [messages.length, loading])

  useEffect(() => {
    const container = messageAreaRef.current
    if (!container) return

    if (messages.length > previousMessageCountRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }

    previousMessageCountRef.current = messages.length
  }, [messages])

  async function sendMessage(customMessage) {
    const outgoing = typeof customMessage === 'string' ? customMessage : input

    if (!outgoing.trim() || loading) return null

    const userMessage = { role: 'user', text: outgoing }
    const nextMessages = [...messages, userMessage]

    setMessages([
      ...nextMessages,
      {
        role: 'assistant',
        text: 'VIC is thinking...',
      },
    ])

    setLoading(true)
    setInput('')

    try {
      const apiMessages = nextMessages.map((msg) => ({
        role: msg.role,
        content: msg.text,
      }))

      const res = await fetch('/api/vic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      const finalReply = data.reply || 'No reply'
      const visual = inferVisualFromConversation(outgoing, finalReply)

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: finalReply,
          visual,
        },
      ])

      return finalReply
    } catch (error) {
      const errorReply = 'Something went wrong. Please try again.'
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: errorReply,
          visual: {
            type: 'tip',
            title: 'Quick fix',
            body: 'Try sending the message again. If it keeps happening, check the API route or OpenAI response.',
          },
        },
      ])
      return errorReply
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      sendMessage()
    }
  }

  function startSubject(subject) {
    const subjectMessage = `I want to start a ${subject} lesson. Please guide me step by step.`
    sendMessage(subjectMessage)
  }

  async function requestReport() {
    const finalReply = await sendMessage('Generate a clean structured session report for download.')
    if (finalReply) {
      downloadReport(finalReply)
    }
  }

  function downloadReport(text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'VIC-Report.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
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
      <div style={styles.backgroundGlowThree} />
      <div style={styles.backgroundMesh} />

      <div style={styles.shell}>
        <div style={styles.leftColumn}>
          <section style={styles.heroCard}>
            <div style={styles.heroTop}>
              <div style={styles.logoImageWrap}>
                <img
                  src="/vic-logo.png"
                  alt="VIC Virtual Co-Teacher logo"
                  style={styles.logoImage}
                />
              </div>

              <div style={styles.heroTextWrap}>
                <div style={styles.versionPill}>Brain {BRAIN_VERSION}</div>
                <h1 style={styles.heading}>More than answers. Real teaching.</h1>
                <p style={styles.tagline}>
                  Guided help that feels calm, clear, and personal.
                </p>
              </div>
            </div>

            <div style={styles.quickStartWrap}>
              <div style={styles.sectionEyebrow}>Start Learning</div>
              <div style={styles.subjectGrid}>
                <button style={styles.subjectButton} onClick={() => startSubject('math')}>
                  <span style={styles.subjectButtonLabel}>Math</span>
                  <span style={styles.subjectButtonSub}>Practice and problem solving</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('reading')}>
                  <span style={styles.subjectButtonLabel}>Reading</span>
                  <span style={styles.subjectButtonSub}>Comprehension and analysis</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('writing')}>
                  <span style={styles.subjectButtonLabel}>Writing</span>
                  <span style={styles.subjectButtonSub}>Ideas, drafting, and revision</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('science')}>
                  <span style={styles.subjectButtonLabel}>Science</span>
                  <span style={styles.subjectButtonSub}>Concepts, vocabulary, and inquiry</span>
                </button>
              </div>
            </div>
          </section>

          <section style={styles.toolsCard}>
            <div style={styles.toolsHeaderRow}>
              <div style={styles.toolsHeaderText}>
                <div style={styles.sectionEyebrow}>Workspace Tools</div>
                <div style={styles.sectionTitle}>Practice, notes, and report</div>
              </div>

              <button
                style={canGetReport ? styles.reportButton : styles.reportButtonDisabled}
                onClick={requestReport}
                disabled={!canGetReport}
              >
                Get Report
              </button>
            </div>

            <div style={styles.toolToggleRow}>
              <button
                style={showCalculator ? styles.toolToggleActive : styles.toolToggle}
                onClick={() => setShowCalculator(!showCalculator)}
              >
                Calculator
              </button>

              <button
                style={showNotes ? styles.toolToggleActive : styles.toolToggle}
                onClick={() => setShowNotes(!showNotes)}
              >
                Notes
              </button>
            </div>

            <div style={styles.practiceWrap}>
              <div style={styles.miniLabel}>Practice Area</div>
              <textarea
                value={workArea}
                onChange={(e) => setWorkArea(e.target.value)}
                placeholder="Let’s practice here..."
                style={styles.sideTextarea}
              />
            </div>

            {showCalculator ? (
              <div style={styles.toolPanel}>
                <div style={styles.miniLabelDark}>Calculator</div>
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
                <div style={styles.miniLabelDark}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keep notes here..."
                  style={styles.notesTextarea}
                />
              </div>
            ) : null}
          </section>
        </div>

        <div style={styles.rightColumn}>
          <section style={styles.chatCard}>
            <div style={styles.chatHeader}>
              <div>
                <div style={styles.chatEyebrow}>Guided Session</div>
                <div style={styles.chatTitle}>Conversation</div>
              </div>

              <div style={styles.statusWrap}>
                <span style={styles.statusDot} />
                <span style={styles.statusText}>{loading ? 'Thinking' : 'Ready'}</span>
              </div>
            </div>

            <div ref={messageAreaRef} style={styles.messageArea}>
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
                    style={msg.role === 'assistant' ? styles.bubbleText : styles.userBubbleText}
                  >
                    {msg.text}
                  </p>

                  {msg.role === 'assistant' && msg.visual ? (
                    <VisualCardRenderer visual={msg.visual} />
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section style={styles.inputCard}>
            <div style={styles.inputHeaderRow}>
              <div>
                <div style={styles.chatEyebrow}>Write to VIC</div>
                <div style={styles.inputTitle}>Your message</div>
              </div>

              <div style={styles.inputHint}>Enter = new line • Ctrl/Cmd + Enter = send</div>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              placeholder="Type here..."
              style={styles.mainTextarea}
            />

            <div style={styles.inputFooter}>
              <div style={styles.footerPrompt}>
                Shorter turns work best. One thought or question at a time.
              </div>

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
          </section>
        </div>
      </div>
    </div>
  )
}

function VisualCardRenderer({ visual }) {
  if (!visual || !visual.type) return null

  if (visual.type === 'idle') {
    return (
      <div style={styles.visualIdleCard}>
        <div style={styles.visualIdleGlow} />
        <div style={styles.visualIdleInner}>
          <img
            src="/vic-logo.png"
            alt="VIC logo"
            style={styles.visualIdleLogo}
          />
          <div style={styles.visualIdleTextWrap}>
            <div style={styles.visualIdleTitle}>Visual support will appear here</div>
            <div style={styles.visualIdleText}>
              Diagrams, models, and step visuals show up only when they help.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (visual.type === 'fraction') {
    const numerator = Math.max(0, Number(visual.numerator) || 0)
    const denominator = Math.max(1, Number(visual.denominator) || 1)

    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Fraction model'}</div>
          <div style={styles.visualBadge}>
            {numerator}/{denominator}
          </div>
        </div>

        <div style={styles.fractionBarWrap}>
          {Array.from({ length: denominator }).map((_, index) => (
            <div
              key={index}
              style={{
                ...styles.fractionPiece,
                background:
                  index < numerator
                    ? 'linear-gradient(135deg, #7c5cff 0%, #43e7d0 100%)'
                    : '#e2e8f0',
              }}
            />
          ))}
        </div>

        <div style={styles.visualDescription}>
          {numerator} out of {denominator} equal parts are shaded.
        </div>
      </div>
    )
  }

  if (visual.type === 'numberline') {
    const start = Number.isFinite(visual.start) ? visual.start : 0
    const end = Number.isFinite(visual.end) ? visual.end : 10
    const highlight = Number.isFinite(visual.highlight) ? visual.highlight : start
    const values = []

    for (let i = start; i <= end; i += 1) {
      values.push(i)
    }

    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Number line'}</div>
          <div style={styles.visualBadge}>Math visual</div>
        </div>

        <div style={styles.numberLineWrap}>
          <div style={styles.numberLineBase} />
          <div style={styles.numberLineRow}>
            {values.map((value) => {
              const isHighlight = value === highlight

              return (
                <div key={value} style={styles.numberTickWrap}>
                  <div
                    style={{
                      ...styles.numberDot,
                      background: isHighlight ? '#7c5cff' : '#94a3b8',
                      boxShadow: isHighlight ? '0 0 0 5px rgba(124,92,255,0.14)' : 'none',
                    }}
                  />
                  <div
                    style={{
                      ...styles.numberLabel,
                      color: isHighlight ? '#4338ca' : '#475569',
                      fontWeight: isHighlight ? 700 : 600,
                    }}
                  >
                    {value}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={styles.visualDescription}>
          The highlighted point shows {highlight}.
        </div>
      </div>
    )
  }

  if (visual.type === 'vocab') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Vocabulary card'}</div>
          <div style={styles.visualBadge}>ELA support</div>
        </div>

        <div style={styles.vocabWord}>{visual.word || 'Vocabulary'}</div>
        <div style={styles.vocabDefinition}>{visual.definition || ''}</div>

        {visual.example ? (
          <div style={styles.vocabExampleBox}>
            <div style={styles.vocabExampleLabel}>Example</div>
            <div style={styles.vocabExampleText}>{visual.example}</div>
          </div>
        ) : null}
      </div>
    )
  }

  if (visual.type === 'tip') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Quick tip'}</div>
          <div style={styles.visualBadge}>Support</div>
        </div>
        <div style={styles.visualDescription}>{visual.body || ''}</div>
      </div>
    )
  }

  return null
}

function inferVisualFromConversation(userText, assistantText) {
  const combined = `${userText} ${assistantText}`.toLowerCase()

  const fractionMatch =
    combined.match(/(\d+)\s*\/\s*(\d+)/) ||
    combined.match(/(\d+)\s+out of\s+(\d+)/)

  if (
    fractionMatch &&
    !combined.includes('grade 10') &&
    !combined.includes('chapter') &&
    !combined.includes('page')
  ) {
    const numerator = Number(fractionMatch[1])
    const denominator = Number(fractionMatch[2])

    if (denominator > 0 && denominator <= 12 && numerator <= denominator) {
      return {
        type: 'fraction',
        title: 'Fraction model',
        numerator,
        denominator,
      }
    }
  }

  const numberMatch =
    combined.match(/\bnumber line\b/) ||
    combined.match(/\bcount\b/) ||
    combined.match(/\binteger\b/) ||
    combined.match(/\bnegative\b/)

  if (numberMatch) {
    const highlightMatch = assistantText.match(/-?\d+/)
    const highlight = highlightMatch ? Number(highlightMatch[0]) : 3
    const start = Math.min(highlight - 3, 0)
    const end = Math.max(highlight + 3, 6)

    return {
      type: 'numberline',
      title: 'Number line',
      start,
      end,
      highlight,
    }
  }

  if (
    combined.includes('vocabulary') ||
    combined.includes('define') ||
    combined.includes('definition') ||
    combined.includes('meaning of')
  ) {
    const vocab = extractVocabularyCard(assistantText)
    if (vocab) return vocab
  }

  return {
    type: 'idle',
    title: 'Visual Support',
  }
}

function extractVocabularyCard(text) {
  if (!text) return null

  const pattern = /([A-Za-z][A-Za-z\s-]{1,30})\s+(means|is)\s+([^.!?]{8,180})/i
  const match = text.match(pattern)

  if (!match) return null

  const word = match[1].trim()
  const definition = match[3].trim()

  return {
    type: 'vocab',
    title: 'Vocabulary',
    word,
    definition,
    example: 'Try using the word in your own sentence.',
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 14% 10%, rgba(124, 92, 255, 0.28), transparent 26%), radial-gradient(circle at 82% 88%, rgba(0, 255, 200, 0.12), transparent 28%), linear-gradient(135deg, #030816 0%, #08142d 48%, #09213a 100%)',
    color: '#e8eefc',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },

  backgroundGlowOne: {
    position: 'absolute',
    top: '-100px',
    left: '-80px',
    width: '280px',
    height: '280px',
    background: 'rgba(110, 92, 255, 0.16)',
    filter: 'blur(80px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowTwo: {
    position: 'absolute',
    bottom: '-100px',
    right: '-60px',
    width: '300px',
    height: '300px',
    background: 'rgba(0, 255, 200, 0.12)',
    filter: 'blur(88px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowThree: {
    position: 'absolute',
    top: '34%',
    right: '18%',
    width: '220px',
    height: '220px',
    background: 'rgba(70, 130, 255, 0.10)',
    filter: 'blur(75px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundMesh: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
    maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0.2))',
    pointerEvents: 'none',
  },

  shell: {
    maxWidth: '1440px',
    height: '100vh',
    margin: '0 auto',
    padding: '18px',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: '380px minmax(0, 1fr)',
    gap: '18px',
  },

  leftColumn: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '0.98fr 1.02fr',
    gap: '18px',
  },

  rightColumn: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '1fr 240px',
    gap: '18px',
  },

  heroCard: {
    minHeight: 0,
    background: 'linear-gradient(180deg, rgba(12, 23, 48, 0.90) 0%, rgba(9, 18, 38, 0.82) 100%)',
    border: '1px solid rgba(145, 160, 255, 0.14)',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: '0 20px 52px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflow: 'hidden',
  },

  heroTop: {
    display: 'grid',
    gridTemplateColumns: '126px 1fr',
    gap: '18px',
    alignItems: 'center',
  },

  logoImageWrap: {
    width: '126px',
    height: '126px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,245,255,0.96) 100%)',
    borderRadius: '24px',
    padding: '12px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72), 0 14px 34px rgba(0,0,0,0.18)',
  },

  logoImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'contain',
  },

  heroTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },

  versionPill: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: 800,
    color: '#eaf0ff',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    padding: '6px 10px',
    boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
  },

  heading: {
    margin: 0,
    fontSize: '34px',
    lineHeight: 1.02,
    letterSpacing: '-0.03em',
    fontWeight: 700,
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },

  tagline: {
    margin: 0,
    fontSize: '16px',
    lineHeight: 1.45,
    color: '#cad7f3',
    maxWidth: '320px',
  },

  quickStartWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    justifyContent: 'center',
  },

  sectionEyebrow: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#9db2ff',
    fontWeight: 800,
    marginBottom: '2px',
  },

  sectionTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#f2f6ff',
    marginTop: '2px',
    lineHeight: 1.15,
  },

  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },

  subjectButton: {
    border: '1px solid rgba(255,255,255,0.12)',
    background:
      'linear-gradient(135deg, rgba(143,124,255,0.16) 0%, rgba(63,241,208,0.08) 100%)',
    color: '#f7fbff',
    padding: '14px 16px',
    borderRadius: '18px',
    fontSize: '15px',
    fontWeight: 800,
    textAlign: 'left',
    boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    transition: 'transform 180ms ease, box-shadow 180ms ease',
    minHeight: '82px',
    overflow: 'hidden',
  },

  subjectButtonLabel: {
    fontSize: '16px',
    fontWeight: 800,
  },

  subjectButtonSub: {
    fontSize: '11px',
    lineHeight: 1.35,
    color: '#c7d6f5',
    fontWeight: 600,
  },

  toolsCard: {
    minHeight: 0,
    background: 'linear-gradient(180deg, rgba(12, 23, 48, 0.90) 0%, rgba(9, 18, 38, 0.82) 100%)',
    border: '1px solid rgba(145, 160, 255, 0.14)',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: '0 20px 52px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
  },

  toolsHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'start',
    gap: '12px',
  },

  toolsHeaderText: {
    minWidth: 0,
  },

  reportButton: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))',
    color: '#f7fbff',
    padding: '10px 14px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    alignSelf: 'start',
  },

  reportButtonDisabled: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#90a3cd',
    padding: '10px 14px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    alignSelf: 'start',
  },

  toolToggleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },

  toolToggle: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#eef4ff',
    padding: '12px 14px',
    borderRadius: '15px',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow: '0 8px 18px rgba(0,0,0,0.12)',
  },

  toolToggleActive: {
    background:
      'linear-gradient(135deg, rgba(143,124,255,0.22) 0%, rgba(63,241,208,0.12) 100%)',
    border: '1px solid rgba(143,124,255,0.32)',
    color: '#ffffff',
    padding: '12px 14px',
    borderRadius: '15px',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow: '0 8px 18px rgba(0,0,0,0.14)',
  },

  practiceWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  miniLabel: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#e7efff',
  },

  miniLabelDark: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '10px',
  },

  sideTextarea: {
    width: '100%',
    minHeight: '146px',
    borderRadius: '18px',
    border: '1px solid rgba(173, 193, 255, 0.22)',
    background: 'linear-gradient(180deg, rgba(30,45,82,0.88) 0%, rgba(23,35,67,0.88) 100%)',
    color: '#eef4ff',
    padding: '14px 16px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 24px rgba(0,0,0,0.14)',
  },

  toolPanel: {
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '18px',
    padding: '14px',
    boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
  },

  calcInput: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid #d6deec',
    background: '#f8fbff',
    color: '#0f172a',
    padding: '12px 13px',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  },

  calcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '12px',
  },

  smallButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 800,
    color: '#07111e',
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
    boxShadow: '0 8px 20px rgba(63,241,208,0.18)',
  },

  calcResult: {
    minHeight: '22px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#334155',
    wordBreak: 'break-word',
  },

  notesTextarea: {
    width: '100%',
    minHeight: '130px',
    borderRadius: '14px',
    border: '1px solid #d6deec',
    background: '#f8fbff',
    color: '#0f172a',
    padding: '12px 13px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  chatCard: {
    minHeight: 0,
    background: 'linear-gradient(180deg, rgba(8, 16, 34, 0.92) 0%, rgba(8, 15, 31, 0.84) 100%)',
    border: '1px solid rgba(145, 160, 255, 0.14)',
    borderRadius: '30px',
    padding: '18px',
    boxShadow: '0 22px 60px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },

  chatEyebrow: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#97adff',
    fontWeight: 800,
  },

  chatTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#f5f8ff',
    marginTop: '4px',
  },

  statusWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '999px',
    padding: '8px 12px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
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

  messageArea: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    background:
      'linear-gradient(180deg, rgba(248,251,255,0.98) 0%, rgba(239,245,255,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '24px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 16px 34px rgba(6,10,18,0.10)',
  },

  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '76%',
    background: '#f7faff',
    border: '1px solid #dbe6f4',
    borderRadius: '22px',
    padding: '16px 17px',
    boxShadow: '0 12px 26px rgba(15,23,42,0.06)',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '72%',
    background: 'linear-gradient(135deg, #eef4ff 0%, #e3fbf6 100%)',
    border: '1px solid #cfe0ff',
    borderRadius: '22px',
    padding: '16px 17px',
    boxShadow: '0 12px 26px rgba(15,23,42,0.06)',
  },

  bubbleLabel: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#5f7290',
    fontWeight: 800,
    marginBottom: '8px',
    textTransform: 'uppercase',
  },

  bubbleLabelUser: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    color: '#355e9b',
    fontWeight: 800,
    marginBottom: '8px',
    textTransform: 'uppercase',
  },

  bubbleText: {
    margin: 0,
    fontSize: '17px',
    lineHeight: 1.68,
    color: '#0f172a',
    whiteSpace: 'pre-wrap',
  },

  userBubbleText: {
    margin: 0,
    fontSize: '17px',
    lineHeight: 1.68,
    color: '#0f172a',
    whiteSpace: 'pre-wrap',
  },

  inputCard: {
    background: 'linear-gradient(180deg, rgba(8, 16, 34, 0.92) 0%, rgba(8, 15, 31, 0.84) 100%)',
    border: '1px solid rgba(145, 160, 255, 0.14)',
    borderRadius: '30px',
    padding: '18px',
    boxShadow: '0 22px 60px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  inputHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },

  inputTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#f5f8ff',
    marginTop: '4px',
  },

  inputHint: {
    fontSize: '13px',
    color: '#cdd9f4',
    textAlign: 'right',
    maxWidth: '250px',
    lineHeight: 1.4,
  },

  mainTextarea: {
    width: '100%',
    minHeight: '112px',
    borderRadius: '22px',
    border: '1px solid rgba(255,255,255,0.20)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,251,255,0.99) 100%)',
    color: '#0f172a',
    padding: '18px',
    fontSize: '18px',
    lineHeight: 1.55,
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.78), 0 18px 34px rgba(6,10,18,0.12)',
  },

  inputFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },

  footerPrompt: {
    fontSize: '14px',
    lineHeight: 1.45,
    color: '#d5e0fb',
    maxWidth: '520px',
  },

  sendButton: {
    border: 'none',
    borderRadius: '16px',
    padding: '13px 24px',
    fontSize: '15px',
    fontWeight: 800,
    color: '#07111e',
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
    boxShadow: '0 14px 30px rgba(63, 241, 208, 0.24)',
    whiteSpace: 'nowrap',
  },

  visualCard: {
    marginTop: '12px',
    background: '#ffffff',
    border: '1px solid #d8e2ee',
    borderRadius: '16px',
    padding: '14px',
    boxShadow: '0 10px 20px rgba(15,23,42,0.05)',
  },

  visualIdleCard: {
    marginTop: '14px',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '18px',
    background:
      'linear-gradient(135deg, rgba(238,242,255,0.92) 0%, rgba(232,250,246,0.82) 100%)',
    border: '1px solid rgba(203,213,225,0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },

  visualIdleGlow: {
    position: 'absolute',
    inset: 'auto auto -30px -20px',
    width: '130px',
    height: '130px',
    borderRadius: '50%',
    background: 'rgba(124,92,255,0.12)',
    filter: 'blur(10px)',
  },

  visualIdleInner: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: '98px 1fr',
    gap: '16px',
    alignItems: 'center',
    padding: '16px',
  },

  visualIdleLogo: {
    width: '98px',
    height: '98px',
    objectFit: 'contain',
    opacity: 0.78,
    filter: 'drop-shadow(0 8px 16px rgba(15,23,42,0.10))',
  },

  visualIdleTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  visualIdleTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#25334f',
  },

  visualIdleText: {
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#51617d',
    maxWidth: '340px',
  },

  visualHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  },

  visualTitle: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#0f172a',
  },

  visualBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#4f46e5',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '999px',
    padding: '5px 9px',
    whiteSpace: 'nowrap',
  },

  visualDescription: {
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#334155',
  },

  fractionBarWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(28px, 1fr))',
    gap: '8px',
    marginBottom: '12px',
  },

  fractionPiece: {
    height: '34px',
    borderRadius: '10px',
  },

  numberLineWrap: {
    position: 'relative',
    paddingTop: '14px',
    paddingBottom: '6px',
  },

  numberLineBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '30px',
    height: '3px',
    borderRadius: '999px',
    background: '#cbd5e1',
  },

  numberLineRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(38px, 1fr))',
    gap: '4px',
    position: 'relative',
  },

  numberTickWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },

  numberDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    zIndex: 1,
  },

  numberLabel: {
    fontSize: '13px',
  },

  vocabWord: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '8px',
  },

  vocabDefinition: {
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#334155',
  },

  vocabExampleBox: {
    marginTop: '12px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px',
  },

  vocabExampleLabel: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#64748b',
    marginBottom: '6px',
  },

  vocabExampleText: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: 1.5,
  },
}
