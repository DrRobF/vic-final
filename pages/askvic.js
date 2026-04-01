import { useEffect, useMemo, useRef, useState } from 'react'

const BRAIN_VERSION = 'v3.3'

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
      text:
        'Let’s start learning 👇\n\nTry something like:\n• "Help me understand fractions"\n• "Give me a reading passage"\n\nOr pick a subject on the left.',
      visual: { type: 'idle', title: 'Visual Support' },
    },
  ])

  const messageAreaRef = useRef(null)
  const messageRefs = useRef([])

  const canGetReport = useMemo(() => messages.length > 1 && !loading, [messages.length, loading])

  useEffect(() => {
    const container = messageAreaRef.current
    if (!container) return

    const lastMessage = messageRefs.current[messages.length - 1]
    if (!lastMessage) return

    const containerRect = container.getBoundingClientRect()
    const messageRect = lastMessage.getBoundingClientRect()
    const currentScroll = container.scrollTop
    const offsetTop = messageRect.top - containerRect.top + currentScroll
    const targetTop = Math.max(offsetTop - 16, 0)

    container.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    })
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
      <div style={styles.backgroundGlowFour} />
      <div style={styles.backgroundMesh} />
      <div style={styles.backgroundSweep} />

      <div style={styles.shell}>
        <div style={styles.leftColumn}>
          <section style={styles.heroCard}>
            <div style={styles.heroSparkle} />
            <div style={styles.heroTop}>
              <div style={styles.logoImageWrap}>
                <div style={styles.logoImageGlow} />
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
                  <span style={styles.subjectButtonGlow} />
                  <span style={styles.subjectButtonLabel}>Math</span>
                  <span style={styles.subjectButtonSub}>Start a math lesson</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('reading')}>
                  <span style={styles.subjectButtonGlow} />
                  <span style={styles.subjectButtonLabel}>Reading</span>
                  <span style={styles.subjectButtonSub}>Practice comprehension</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('writing')}>
                  <span style={styles.subjectButtonGlow} />
                  <span style={styles.subjectButtonLabel}>Writing</span>
                  <span style={styles.subjectButtonSub}>Draft and revise ideas</span>
                </button>
                <button style={styles.subjectButton} onClick={() => startSubject('science')}>
                  <span style={styles.subjectButtonGlow} />
                  <span style={styles.subjectButtonLabel}>Science</span>
                  <span style={styles.subjectButtonSub}>Explore concepts step by step</span>
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
              <div style={styles.practiceHeaderRow}>
                <div style={styles.miniLabel}>Practice Area</div>
                <div style={styles.practiceHint}>Work it out here while VIC teaches.</div>
              </div>

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

            <div style={styles.chatCanvas}>
              <div ref={messageAreaRef} style={styles.messageArea}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      messageRefs.current[index] = el
                    }}
                    style={msg.role === 'assistant' ? styles.assistantBubble : styles.userBubble}
                  >
                    <div
                      style={
                        msg.role === 'assistant' ? styles.bubbleLabel : styles.bubbleLabelUser
                      }
                    >
                      {msg.role === 'assistant' ? 'VIC' : 'You'}
                    </div>

                    <p style={msg.role === 'assistant' ? styles.bubbleText : styles.userBubbleText}>
                      {msg.text}
                    </p>

                    {msg.role === 'assistant' && msg.visual ? (
                      <VisualCardRenderer visual={msg.visual} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={styles.inputCard}>
            <div style={styles.inputHeaderRow}>
              <div>
                <div style={styles.chatEyebrow}>Write to VIC</div>
                <div style={styles.inputTitle}>Your message</div>
              </div>

              <div style={styles.inputHint}>Enter = send • Shift + Enter = new line</div>
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
                Pick a subject or ask a question. One thought at a time works best.
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
          <img src="/vic-logo.png" alt="VIC logo" style={styles.visualIdleLogo} />
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
                    ? 'linear-gradient(135deg, rgba(156,85,255,1) 0%, rgba(93,231,255,1) 100%)'
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
                      background: isHighlight ? '#9c55ff' : '#94a3b8',
                      boxShadow: isHighlight ? '0 0 0 5px rgba(156,85,255,0.18)' : 'none',
                    }}
                  />
                  <div
                    style={{
                      ...styles.numberLabel,
                      color: isHighlight ? '#6d28d9' : '#475569',
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
    height: '100vh',
    background:
      'radial-gradient(circle at 14% 8%, rgba(159, 87, 255, 0.34), transparent 24%), radial-gradient(circle at 82% 84%, rgba(84, 248, 255, 0.16), transparent 26%), radial-gradient(circle at 50% 20%, rgba(247, 95, 255, 0.10), transparent 28%), linear-gradient(135deg, #060412 0%, #130925 42%, #0a1630 100%)',
    color: '#f2edff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
    position: 'relative',
    overflow: 'auto',
  },

  backgroundGlowOne: {
    position: 'absolute',
    top: '-120px',
    left: '-90px',
    width: '320px',
    height: '320px',
    background: 'rgba(166, 82, 255, 0.24)',
    filter: 'blur(90px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowTwo: {
    position: 'absolute',
    bottom: '-120px',
    right: '-70px',
    width: '340px',
    height: '340px',
    background: 'rgba(84, 248, 255, 0.14)',
    filter: 'blur(92px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowThree: {
    position: 'absolute',
    top: '26%',
    right: '16%',
    width: '240px',
    height: '240px',
    background: 'rgba(247, 95, 255, 0.12)',
    filter: 'blur(82px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowFour: {
    position: 'absolute',
    bottom: '12%',
    left: '8%',
    width: '220px',
    height: '220px',
    background: 'rgba(130, 84, 255, 0.16)',
    filter: 'blur(75px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundMesh: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
    maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.25))',
    pointerEvents: 'none',
  },

  backgroundSweep: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(115deg, transparent 0%, transparent 36%, rgba(186, 94, 255, 0.05) 50%, transparent 64%, transparent 100%)',
    pointerEvents: 'none',
  },

  shell: {
    maxWidth: '1440px',
    height: '100vh',
    margin: '0 auto',
    padding: '18px',
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: '392px minmax(0, 1fr)',
    gap: '18px',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
  },

  leftColumn: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
    gap: '18px',
    overflow: 'hidden',
  },

  rightColumn: {
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '1fr 240px',
    gap: '18px',
  },

  heroCard: {
    minHeight: 0,
    background: 'linear-gradient(180deg, rgba(18, 8, 38, 0.92) 0%, rgba(10, 15, 35, 0.84) 100%)',
    border: '1px solid rgba(191, 141, 255, 0.22)',
    borderRadius: '28px',
    padding: '14px',
    boxShadow:
      '0 20px 52px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.02), 0 0 36px rgba(171, 91, 255, 0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
    position: 'relative',
  },

  heroSparkle: {
    position: 'absolute',
    top: '-26px',
    right: '-14px',
    width: '170px',
    height: '170px',
    background: 'radial-gradient(circle, rgba(84,248,255,0.18) 0%, rgba(84,248,255,0.0) 72%)',
    pointerEvents: 'none',
  },

  heroTop: {
    display: 'grid',
    gridTemplateColumns: '118px 1fr',
    gap: '14px',
    alignItems: 'center',
  },

  logoImageWrap: {
    width: '118px',
    height: '118px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,238,255,0.96) 100%)',
    borderRadius: '22px',
    padding: '8px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 28px rgba(0,0,0,0.22), 0 0 28px rgba(171, 91, 255, 0.16)',
    position: 'relative',
    overflow: 'hidden',
  },

  logoImageGlow: {
    position: 'absolute',
    inset: '-20%',
    background: 'radial-gradient(circle at 50% 35%, rgba(171, 91, 255, 0.22), transparent 48%)',
    pointerEvents: 'none',
  },

  logoImage: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'contain',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.96)',
    position: 'relative',
    zIndex: 1,
  },

  heroTextWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  versionPill: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: 800,
    color: '#f5ebff',
    background: 'linear-gradient(135deg, rgba(171,91,255,0.22), rgba(84,248,255,0.10))',
    border: '1px solid rgba(203, 166, 255, 0.28)',
    borderRadius: '999px',
    padding: '6px 10px',
    boxShadow: '0 0 18px rgba(171,91,255,0.18)',
  },

  heading: {
    margin: 0,
    fontSize: '30px',
    lineHeight: 1.0,
    letterSpacing: '-0.03em',
    fontWeight: 700,
    color: '#faf5ff',
    textShadow: '0 0 22px rgba(171,91,255,0.12)',
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },

  tagline: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.35,
    color: '#dccbff',
    maxWidth: '230px',
  },

  quickStartWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    justifyContent: 'flex-start',
    paddingTop: '2px',
  },

  sectionEyebrow: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#bca1ff',
    fontWeight: 800,
    marginBottom: '0px',
    textShadow: '0 0 12px rgba(171,91,255,0.16)',
  },

  sectionTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#faf5ff',
    marginTop: '2px',
    lineHeight: 1.15,
  },

  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    paddingBottom: '2px',
  },

  subjectButton: {
    position: 'relative',
    border: '1px solid rgba(200, 156, 255, 0.20)',
    background:
      'linear-gradient(135deg, rgba(67,43,112,0.70) 0%, rgba(18,28,65,0.82) 100%)',
    color: '#f9f3ff',
    padding: '14px',
    borderRadius: '18px',
    fontSize: '15px',
    fontWeight: 800,
    textAlign: 'left',
    boxShadow:
      '0 12px 28px rgba(0,0,0,0.20), 0 0 22px rgba(171,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minHeight: '88px',
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },

  subjectButtonGlow: {
    position: 'absolute',
    inset: '-35%',
    background: 'radial-gradient(circle at 18% 18%, rgba(171,91,255,0.18), transparent 38%)',
    pointerEvents: 'none',
  },

  subjectButtonLabel: {
    fontSize: '16px',
    fontWeight: 800,
    position: 'relative',
    zIndex: 1,
    textShadow: '0 0 14px rgba(171,91,255,0.14)',
  },

  subjectButtonSub: {
    fontSize: '11px',
    lineHeight: 1.3,
    color: '#ddd0ff',
    fontWeight: 600,
    position: 'relative',
    zIndex: 1,
  },

  toolsCard: {
    minHeight: 0,
    background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.92) 0%, rgba(9, 14, 31, 0.86) 100%)',
    border: '1px solid rgba(191, 141, 255, 0.20)',
    borderRadius: '28px',
    padding: '16px',
    boxShadow:
      '0 20px 52px rgba(0,0,0,0.30), 0 0 30px rgba(171,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
    border: '1px solid rgba(206, 170, 255, 0.24)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(171,91,255,0.10))',
    color: '#faf5ff',
    padding: '10px 14px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    boxShadow: '0 0 24px rgba(171,91,255,0.12)',
    alignSelf: 'start',
    cursor: 'pointer',
  },

  reportButtonDisabled: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#9d8dc4',
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
    background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(171,91,255,0.06))',
    border: '1px solid rgba(206, 170, 255, 0.18)',
    color: '#f3edff',
    padding: '12px 14px',
    borderRadius: '15px',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow: '0 0 18px rgba(171,91,255,0.08)',
    cursor: 'pointer',
  },

  toolToggleActive: {
    background:
      'linear-gradient(135deg, rgba(171,91,255,0.26) 0%, rgba(84,248,255,0.12) 100%)',
    border: '1px solid rgba(206, 170, 255, 0.28)',
    color: '#ffffff',
    padding: '12px 14px',
    borderRadius: '15px',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow: '0 0 24px rgba(171,91,255,0.16)',
    cursor: 'pointer',
  },

  practiceWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  practiceHeaderRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },

  practiceHint: {
    fontSize: '12px',
    color: '#ccbfff',
    lineHeight: 1.4,
  },

  miniLabel: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#faf5ff',
  },

  miniLabelDark: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '10px',
  },

  sideTextarea: {
    width: '100%',
    minHeight: '158px',
    borderRadius: '18px',
    border: '1px solid rgba(200, 156, 255, 0.18)',
    background: 'linear-gradient(180deg, rgba(53,45,101,0.96) 0%, rgba(34,36,82,0.94) 100%)',
    color: '#f4efff',
    padding: '16px',
    fontSize: '15px',
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px rgba(171,91,255,0.10)',
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
    background: 'linear-gradient(135deg, #a657ff 0%, #54f8ff 100%)',
    boxShadow: '0 0 22px rgba(171,91,255,0.22)',
    cursor: 'pointer',
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
    gap: '16px',
    overflow: 'hidden',
  },

  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flex: '0 0 auto',
  },

  chatEyebrow: {
    fontSize: '11px',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: '#9db2ff',
    fontWeight: 800,
    marginBottom: '4px',
  },

  chatTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#f8fbff',
    lineHeight: 1.1,
  },

  statusWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    whiteSpace: 'nowrap',
  },

  statusDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: '#54f0c8',
    boxShadow: '0 0 0 6px rgba(84,240,200,0.10)',
  },

  statusText: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#eef4ff',
  },

  chatCanvas: {
    flex: 1,
    minHeight: 0,
    background: '#eef3ff',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
    overflow: 'hidden',
  },

  messageArea: {
    height: '100%',
    overflowY: 'auto',
    paddingRight: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },

  assistantBubble: {
    alignSelf: 'flex-start',
    width: 'min(640px, 100%)',
    background: '#ffffff',
    color: '#0f172a',
    borderRadius: '26px',
    padding: '16px',
    boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
  },

  userBubble: {
    alignSelf: 'flex-end',
    width: 'min(540px, 100%)',
    background: 'linear-gradient(135deg, rgba(124,92,255,0.92) 0%, rgba(63,241,208,0.62) 100%)',
    color: '#07111e',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '26px',
    padding: '16px',
    boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
  },

  bubbleLabel: {
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#516182',
    marginBottom: '8px',
  },

  bubbleLabelUser: {
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#052035',
    marginBottom: '8px',
  },

  bubbleText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    fontSize: '16px',
    color: '#1f2937',
  },

  userBubbleText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    fontSize: '16px',
    color: '#052035',
  },

  inputCard: {
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
    overflow: 'hidden',
  },

  inputHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },

  inputTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#f8fbff',
    lineHeight: 1.1,
  },

  inputHint: {
    fontSize: '12px',
    color: '#b5c5e8',
    lineHeight: 1.4,
    textAlign: 'right',
  },

  mainTextarea: {
    width: '100%',
    minHeight: '106px',
    borderRadius: '20px',
    border: '1px solid rgba(191, 205, 255, 0.18)',
    background: '#eef3ff',
    color: '#0f172a',
    padding: '16px',
    fontSize: '16px',
    lineHeight: 1.5,
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },

  inputFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },

  footerPrompt: {
    fontSize: '13px',
    color: '#c5d3f0',
    lineHeight: 1.5,
  },

  sendButton: {
    border: 'none',
    borderRadius: '16px',
    padding: '13px 20px',
    fontSize: '15px',
    fontWeight: 800,
    color: '#07111e',
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
    boxShadow: '0 12px 28px rgba(63,241,208,0.18)',
  },

  visualIdleCard: {
    position: 'relative',
    marginTop: '16px',
    borderRadius: '20px',
    border: '1px solid rgba(173, 193, 255, 0.24)',
    background: 'linear-gradient(135deg, rgba(234,240,255,0.98) 0%, rgba(225,248,245,0.96) 100%)',
    overflow: 'hidden',
  },

  visualIdleGlow: {
    position: 'absolute',
    inset: '-20%',
    background: 'radial-gradient(circle at 20% 20%, rgba(124,92,255,0.14), transparent 35%)',
    pointerEvents: 'none',
  },

  visualIdleInner: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: '96px 1fr',
    gap: '14px',
    alignItems: 'center',
    padding: '16px',
  },

  visualIdleLogo: {
    width: '96px',
    height: '64px',
    objectFit: 'contain',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.82)',
    padding: '10px',
    boxSizing: 'border-box',
  },

  visualIdleTextWrap: {
    minWidth: 0,
  },

  visualIdleTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#27344f',
    marginBottom: '6px',
  },

  visualIdleText: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#55627c',
  },

  visualCard: {
    marginTop: '16px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    padding: '16px',
    boxShadow: '0 12px 24px rgba(15,23,42,0.08)',
  },

  visualHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '14px',
  },

  visualTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#0f172a',
  },

  visualBadge: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#475569',
    background: '#eef2ff',
    borderRadius: '999px',
    padding: '7px 10px',
    whiteSpace: 'nowrap',
  },

  visualDescription: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#475569',
  },

  fractionBarWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: '8px',
    marginBottom: '14px',
  },

  fractionPiece: {
    minHeight: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(15,23,42,0.06)',
  },

  numberLineWrap: {
    position: 'relative',
    padding: '24px 8px 8px',
    marginBottom: '14px',
  },

  numberLineBase: {
    position: 'absolute',
    left: '8px',
    right: '8px',
    top: '34px',
    height: '4px',
    borderRadius: '999px',
    background: '#cbd5e1',
  },

  numberLineRow: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(42px, 1fr))',
    gap: '2px',
  },

  numberTickWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },

  numberDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    marginTop: '3px',
  },

  numberLabel: {
    fontSize: '13px',
  },

  vocabWord: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '8px',
  },

  vocabDefinition: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: '12px',
  },

  vocabExampleBox: {
    borderRadius: '14px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '12px',
  },

  vocabExampleLabel: {
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#64748b',
    marginBottom: '6px',
  },

  vocabExampleText: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#334155',
  },
}
