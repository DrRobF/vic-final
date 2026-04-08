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
  const [viewportWidth, setViewportWidth] = useState(1400)

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        'Let’s start learning 👇\n\nTry something like:\n• "Help me understand fractions"\n• "Give me a reading passage"\n\nOr pick a subject below to begin.',
      visual: { type: 'idle', title: 'Visual Support' },
    },
  ])

  const messageAreaRef = useRef(null)
  const messageRefs = useRef([])

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth)
      }
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const isMobile = viewportWidth <= 768
  const isTablet = viewportWidth > 768 && viewportWidth <= 1100
  const isCompact = viewportWidth <= 1100

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

  const dynamicStyles = buildStyles({ isMobile, isTablet, isCompact, loading, input })

  const heroSection = (
    <section style={dynamicStyles.heroCard}>
      <div style={dynamicStyles.heroSparkle} />

      <div style={dynamicStyles.heroTop}>
        <div style={dynamicStyles.logoBlock}>
          <div style={dynamicStyles.logoFrame}>
            <img
              src="/vic-logo.png"
              alt="VIC Virtual Co-Teacher logo"
              style={dynamicStyles.logoImage}
            />
          </div>
        </div>

        <div style={dynamicStyles.heroTextWrap}>
          <div style={dynamicStyles.versionPill}>Brain {BRAIN_VERSION}</div>
          <h1 style={dynamicStyles.heading}>More than answers. Real teaching.</h1>
          <p style={dynamicStyles.tagline}>
            Guided help that feels calm, clear, and personal.
          </p>
          <p style={dynamicStyles.supportLine}>
            Extra support for students. Reinforcement for teachers.
          </p>
        </div>
      </div>

      <div style={dynamicStyles.quickStartWrap}>
        <div style={dynamicStyles.sectionEyebrow}>Start Learning</div>
        <div style={dynamicStyles.quickStartText}>
          Pick a subject or ask a question. VIC works best one thought at a time.
        </div>

        <div style={dynamicStyles.subjectGrid}>
          <button style={dynamicStyles.subjectButton} onClick={() => startSubject('math')}>
            <span style={dynamicStyles.subjectButtonGlow} />
            <span style={dynamicStyles.subjectButtonLabel}>Math</span>
            <span style={dynamicStyles.subjectButtonSub}>Start a math lesson</span>
          </button>

          <button style={dynamicStyles.subjectButton} onClick={() => startSubject('reading')}>
            <span style={dynamicStyles.subjectButtonGlow} />
            <span style={dynamicStyles.subjectButtonLabel}>Reading</span>
            <span style={dynamicStyles.subjectButtonSub}>Practice comprehension</span>
          </button>

          <button style={dynamicStyles.subjectButton} onClick={() => startSubject('writing')}>
            <span style={dynamicStyles.subjectButtonGlow} />
            <span style={dynamicStyles.subjectButtonLabel}>Writing</span>
            <span style={dynamicStyles.subjectButtonSub}>Draft and revise ideas</span>
          </button>

          <button style={dynamicStyles.subjectButton} onClick={() => startSubject('science')}>
            <span style={dynamicStyles.subjectButtonGlow} />
            <span style={dynamicStyles.subjectButtonLabel}>Science</span>
            <span style={dynamicStyles.subjectButtonSub}>Explore step by step</span>
          </button>
        </div>
      </div>
    </section>
  )

  const toolsSection = (
    <section style={dynamicStyles.toolsCard}>
      <div style={dynamicStyles.toolsHeaderRow}>
        <div style={dynamicStyles.toolsHeaderText}>
          <div style={dynamicStyles.sectionEyebrow}>Workspace Tools</div>
          <div style={dynamicStyles.sectionTitle}>Practice, notes, and report</div>
          <div style={dynamicStyles.toolsSubtext}>
            Keep your work here while VIC teaches.
          </div>
        </div>

        <button
          style={canGetReport ? dynamicStyles.reportButton : dynamicStyles.reportButtonDisabled}
          onClick={requestReport}
          disabled={!canGetReport}
        >
          Get Report
        </button>
      </div>

      <div style={dynamicStyles.toolToggleRow}>
        <button
          style={showCalculator ? dynamicStyles.toolToggleActive : dynamicStyles.toolToggle}
          onClick={() => setShowCalculator(!showCalculator)}
        >
          Calculator
        </button>

        <button
          style={showNotes ? dynamicStyles.toolToggleActive : dynamicStyles.toolToggle}
          onClick={() => setShowNotes(!showNotes)}
        >
          Notes
        </button>
      </div>

      <div style={dynamicStyles.practiceWrap}>
        <div style={dynamicStyles.practiceHeaderRow}>
          <div style={dynamicStyles.miniLabel}>Practice Area</div>
          <div style={dynamicStyles.practiceHint}>Work it out here while VIC teaches.</div>
        </div>

        <textarea
          value={workArea}
          onChange={(e) => setWorkArea(e.target.value)}
          placeholder="Let’s practice here..."
          style={dynamicStyles.sideTextarea}
        />
      </div>

      {showCalculator ? (
        <div style={dynamicStyles.toolPanel}>
          <div style={dynamicStyles.miniLabelDark}>Calculator</div>
          <input
            value={calcInput}
            onChange={(e) => setCalcInput(e.target.value)}
            placeholder="Example: 12 * (4 + 3)"
            style={dynamicStyles.calcInput}
          />
          <div style={dynamicStyles.calcRow}>
            <button style={dynamicStyles.smallButton} onClick={runCalculator}>
              Calculate
            </button>
            <div style={dynamicStyles.calcResult}>{calcResult}</div>
          </div>
        </div>
      ) : null}

      {showNotes ? (
        <div style={dynamicStyles.toolPanel}>
          <div style={dynamicStyles.miniLabelDark}>Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Keep notes here..."
            style={dynamicStyles.notesTextarea}
          />
        </div>
      ) : null}
    </section>
  )

  return (
    <div style={dynamicStyles.page}>
      <div style={dynamicStyles.backgroundGlowOne} />
      <div style={dynamicStyles.backgroundGlowTwo} />
      <div style={dynamicStyles.backgroundGlowThree} />
      <div style={dynamicStyles.backgroundGlowFour} />
      <div style={dynamicStyles.backgroundMesh} />
      <div style={dynamicStyles.backgroundSweep} />

      <div style={dynamicStyles.appFrame}>
        <header style={dynamicStyles.topNav}>
          <a href="/" style={dynamicStyles.brandLink}>
            <div style={dynamicStyles.brandBadge}>V</div>
            <div style={dynamicStyles.brandTextWrap}>
              <div style={dynamicStyles.brandTitle}>VIC</div>
              <div style={dynamicStyles.brandSub}>Your AI co-teacher</div>
            </div>
          </a>

          <nav style={dynamicStyles.navLinks}>
            <a href="/about" style={dynamicStyles.navLink}>
              About
            </a>
          </nav>
        </header>

        <div style={dynamicStyles.shell}>
          {!isCompact ? (
            <div style={dynamicStyles.leftColumn}>
              {heroSection}
              {toolsSection}
            </div>
          ) : null}

          <div style={dynamicStyles.rightColumn}>
            {isCompact ? heroSection : null}

            <section style={dynamicStyles.chatCard}>
              <div style={dynamicStyles.chatHeader}>
                <div>
                  <div style={dynamicStyles.chatEyebrow}>Guided Session</div>
                  <div style={dynamicStyles.chatTitle}>Conversation</div>
                </div>

                <div style={dynamicStyles.statusWrap}>
                  <span style={dynamicStyles.statusDot} />
                  <span style={dynamicStyles.statusText}>{loading ? 'Thinking' : 'Ready'}</span>
                </div>
              </div>

              <div style={dynamicStyles.chatCanvas}>
                <div ref={messageAreaRef} style={dynamicStyles.messageArea}>
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      ref={(el) => {
                        messageRefs.current[index] = el
                      }}
                      style={msg.role === 'assistant' ? dynamicStyles.assistantBubble : dynamicStyles.userBubble}
                    >
                      <div
                        style={
                          msg.role === 'assistant'
                            ? dynamicStyles.bubbleLabel
                            : dynamicStyles.bubbleLabelUser
                        }
                      >
                        {msg.role === 'assistant' ? 'VIC' : 'You'}
                      </div>

                      <p
                        style={
                          msg.role === 'assistant'
                            ? dynamicStyles.bubbleText
                            : dynamicStyles.userBubbleText
                        }
                      >
                        {msg.text}
                      </p>

                      {msg.role === 'assistant' && msg.visual ? (
                        <VisualCardRenderer visual={msg.visual} styles={dynamicStyles} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={dynamicStyles.inputCard}>
              <div style={dynamicStyles.inputHeaderRow}>
                <div>
                  <div style={dynamicStyles.chatEyebrow}>Write to VIC</div>
                  <div style={dynamicStyles.inputTitle}>Your message</div>
                </div>

                {!isMobile ? (
                  <div style={dynamicStyles.inputHint}>Enter = send • Shift + Enter = new line</div>
                ) : null}
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={isMobile ? 3 : 4}
                placeholder="Type here..."
                style={dynamicStyles.mainTextarea}
              />

              <div style={dynamicStyles.inputFooter}>
                <div style={dynamicStyles.footerPrompt}>
                  Pick a subject or ask a question. One thought at a time works best.
                </div>

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  style={{
                    ...dynamicStyles.sendButton,
                    opacity: loading || !input.trim() ? 0.6 : 1,
                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Thinking...' : 'Send'}
                </button>
              </div>
            </section>

            {isCompact ? toolsSection : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function VisualCardRenderer({ visual, styles }) {
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

        <div style={styles.visualDescription}>The highlighted point shows {highlight}.</div>
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

function buildStyles({ isMobile, isTablet, isCompact }) {
  return {
    page: {
      minHeight: '100vh',
      background:
        'radial-gradient(circle at 14% 8%, rgba(171, 91, 255, 0.38), transparent 24%), radial-gradient(circle at 82% 84%, rgba(171, 91, 255, 0.18), transparent 26%), radial-gradient(circle at 50% 20%, rgba(247, 95, 255, 0.14), transparent 28%), radial-gradient(circle at 78% 72%, rgba(140, 88, 255, 0.14), transparent 26%), linear-gradient(135deg, #070312 0%, #17092b 44%, #10061d 100%)',
      color: '#f2edff',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
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
      background: 'rgba(171, 91, 255, 0.16)',
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
      background: 'rgba(214, 104, 255, 0.14)',
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
      background: 'rgba(171, 91, 255, 0.18)',
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
        'linear-gradient(115deg, transparent 0%, transparent 36%, rgba(171, 91, 255, 0.08) 50%, transparent 64%, transparent 100%)',
      pointerEvents: 'none',
    },

    appFrame: {
      maxWidth: '1440px',
      margin: '0 auto',
      padding: isMobile ? '14px' : '18px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 1,
    },

    topNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      marginBottom: isMobile ? '14px' : '18px',
      padding: isMobile ? '12px 14px' : '14px 16px',
      borderRadius: '22px',
      background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.82) 0%, rgba(9, 14, 31, 0.74) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      boxShadow:
        '0 14px 36px rgba(0,0,0,0.24), 0 0 24px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(14px)',
    },

    brandLink: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
      color: '#faf5ff',
      minWidth: 0,
    },

    brandBadge: {
      width: isMobile ? '38px' : '42px',
      height: isMobile ? '38px' : '42px',
      borderRadius: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.28), rgba(84,248,255,0.12))',
      border: '1px solid rgba(206,170,255,0.22)',
      fontWeight: 800,
      fontSize: isMobile ? '18px' : '20px',
      boxShadow: '0 0 20px rgba(171,91,255,0.16)',
    },

    brandTextWrap: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    },

    brandTitle: {
      fontSize: isMobile ? '18px' : '20px',
      fontWeight: 800,
      lineHeight: 1.05,
      color: '#faf5ff',
    },

    brandSub: {
      fontSize: '12px',
      color: '#d8c7ff',
      lineHeight: 1.25,
    },

    navLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      flexShrink: 0,
    },

    navLink: {
      textDecoration: 'none',
      color: '#f3edff',
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: 700,
      padding: '8px 12px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    },

    shell: {
      display: 'grid',
      gridTemplateColumns: isCompact ? '1fr' : '380px minmax(0, 1fr)',
      gap: isMobile ? '14px' : '18px',
      minHeight: isCompact ? 'auto' : 'calc(100vh - 116px)',
    },

    leftColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
      gap: '18px',
    },

    rightColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: isCompact ? 'auto minmax(380px, 1fr) auto auto' : 'minmax(0, 1fr) auto',
      gap: isMobile ? '14px' : '18px',
    },

    heroCard: {
      minHeight: 0,
      background: 'linear-gradient(180deg, rgba(18, 8, 38, 0.92) 0%, rgba(10, 15, 35, 0.84) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.18)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '16px' : '16px',
      boxShadow:
        '0 20px 52px rgba(0,0,0,0.28), 0 0 28px rgba(171, 91, 255, 0.10), inset 0 1px 0 rgba(255,255,255,0.05)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
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
      gridTemplateColumns: isMobile ? '1fr' : '110px 1fr',
      gap: isMobile ? '12px' : '14px',
      alignItems: isMobile ? 'start' : 'center',
    },

    logoBlock: {
      display: 'flex',
      justifyContent: isMobile ? 'flex-start' : 'center',
    },

    logoFrame: {
      width: isMobile ? '88px' : '108px',
      height: isMobile ? '88px' : '108px',
      borderRadius: isMobile ? '20px' : '22px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,238,255,0.96) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 28px rgba(0,0,0,0.22), 0 0 24px rgba(171, 91, 255, 0.12)',
    },

    logoImage: {
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: 'contain',
      transform: 'scale(1.18)',
      background: 'rgba(255,255,255,0.96)',
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
      color: '#f5ebff',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.22), rgba(84,248,255,0.10))',
      border: '1px solid rgba(203, 166, 255, 0.24)',
      borderRadius: '999px',
      padding: '6px 10px',
      boxShadow: '0 0 16px rgba(171,91,255,0.12)',
    },

    heading: {
      margin: 0,
      fontSize: isMobile ? '26px' : isTablet ? '28px' : '30px',
      lineHeight: 1.02,
      letterSpacing: '-0.03em',
      fontWeight: 700,
      color: '#faf5ff',
      textShadow: '0 0 18px rgba(171,91,255,0.10)',
      fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    },

    tagline: {
      margin: 0,
      fontSize: isMobile ? '14px' : '15px',
      lineHeight: 1.4,
      color: '#dccbff',
      maxWidth: '420px',
    },

    supportLine: {
      margin: 0,
      fontSize: '13px',
      lineHeight: 1.35,
      color: '#bca1ff',
      fontWeight: 700,
    },

    quickStartWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    quickStartText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: '#d8c7ff',
      maxWidth: '560px',
    },

    sectionEyebrow: {
      fontSize: '11px',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: '#bca1ff',
      fontWeight: 800,
      marginBottom: '0px',
    },

    sectionTitle: {
      fontSize: isMobile ? '17px' : '18px',
      fontWeight: 800,
      color: '#faf5ff',
      marginTop: '2px',
      lineHeight: 1.15,
    },

    subjectGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
      gap: '10px',
    },

    subjectButton: {
      position: 'relative',
      border: '1px solid rgba(200, 156, 255, 0.16)',
      background:
        'linear-gradient(135deg, rgba(67,43,112,0.58) 0%, rgba(18,28,65,0.76) 100%)',
      color: '#f9f3ff',
      padding: isMobile ? '13px' : '14px',
      borderRadius: '18px',
      fontSize: '15px',
      fontWeight: 800,
      textAlign: 'left',
      boxShadow:
        '0 10px 22px rgba(0,0,0,0.18), 0 0 16px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minHeight: isMobile ? '82px' : '88px',
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
      fontSize: isMobile ? '15px' : '16px',
      fontWeight: 800,
      position: 'relative',
      zIndex: 1,
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
      background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.90) 0%, rgba(9, 14, 31, 0.84) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '16px' : '16px',
      boxShadow:
        '0 18px 44px rgba(0,0,0,0.26), 0 0 24px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
    },

    toolsHeaderRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
      alignItems: 'start',
      gap: '12px',
    },

    toolsHeaderText: {
      minWidth: 0,
    },

    toolsSubtext: {
      fontSize: '13px',
      color: '#d7c7ff',
      lineHeight: 1.4,
      marginTop: '6px',
    },

    reportButton: {
      border: '1px solid rgba(206, 170, 255, 0.24)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.11), rgba(171,91,255,0.10))',
      color: '#faf5ff',
      padding: '10px 14px',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: 800,
      whiteSpace: 'nowrap',
      boxShadow: '0 0 20px rgba(171,91,255,0.10)',
      alignSelf: 'start',
      cursor: 'pointer',
    },

    reportButtonDisabled: {
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(171,91,255,0.05))',
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
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(171,91,255,0.05))',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      color: '#f3edff',
      padding: '12px 14px',
      borderRadius: '15px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    toolToggleActive: {
      background:
        'linear-gradient(135deg, rgba(171,91,255,0.24) 0%, rgba(84,248,255,0.10) 100%)',
      border: '1px solid rgba(206, 170, 255, 0.24)',
      color: '#ffffff',
      padding: '12px 14px',
      borderRadius: '15px',
      fontSize: '14px',
      fontWeight: 800,
      boxShadow: '0 0 18px rgba(171,91,255,0.12)',
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
      color: '#f3edff',
      marginBottom: '8px',
    },

    sideTextarea: {
      width: '100%',
      minHeight: isMobile ? '120px' : '140px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      background: 'rgba(255,255,255,0.04)',
      color: '#f5f0ff',
      padding: '14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
    },

    toolPanel: {
      borderRadius: '18px',
      border: '1px solid rgba(206, 170, 255, 0.12)',
      background: 'rgba(255,255,255,0.04)',
      padding: '14px',
    },

    calcInput: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      background: 'rgba(9, 14, 31, 0.70)',
      color: '#f5f0ff',
      padding: '12px 14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      marginBottom: '10px',
    },

    calcRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
      gap: '10px',
      alignItems: 'center',
    },

    smallButton: {
      border: '1px solid rgba(206, 170, 255, 0.20)',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.18), rgba(84,248,255,0.08))',
      color: '#faf5ff',
      padding: '10px 14px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    calcResult: {
      minHeight: '20px',
      fontSize: '14px',
      color: '#d8c7ff',
      wordBreak: 'break-word',
    },

    notesTextarea: {
      width: '100%',
      minHeight: '120px',
      resize: 'vertical',
      borderRadius: '14px',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      background: 'rgba(9, 14, 31, 0.70)',
      color: '#f5f0ff',
      padding: '12px 14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
    },

    chatCard: {
      minHeight: isCompact ? '420px' : 0,
      background: 'linear-gradient(180deg, rgba(12, 8, 26, 0.92) 0%, rgba(9, 14, 31, 0.88) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '14px' : '16px',
      boxShadow:
        '0 24px 60px rgba(0,0,0,0.30), 0 0 26px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
    },

    chatHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      marginBottom: '12px',
      paddingBottom: '10px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    },

    chatEyebrow: {
      fontSize: '11px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#bca1ff',
      fontWeight: 800,
      marginBottom: '4px',
    },

    chatTitle: {
      fontSize: isMobile ? '20px' : '22px',
      fontWeight: 800,
      color: '#faf5ff',
      lineHeight: 1.1,
    },

    statusWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    },

    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#67e8f9',
      boxShadow: '0 0 12px rgba(103,232,249,0.8)',
    },

    statusText: {
      fontSize: '13px',
      fontWeight: 700,
      color: '#f3edff',
    },

    chatCanvas: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
    },

    messageArea: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      paddingRight: isMobile ? '2px' : '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    },

    assistantBubble: {
      alignSelf: 'flex-start',
      maxWidth: isMobile ? '94%' : '82%',
      borderRadius: '20px 20px 20px 8px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 15px',
      boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
    },

    userBubble: {
      alignSelf: 'flex-end',
      maxWidth: isMobile ? '94%' : '78%',
      borderRadius: '20px 20px 8px 20px',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.28), rgba(84,248,255,0.10))',
      border: '1px solid rgba(206, 170, 255, 0.16)',
      padding: '14px 15px',
      boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
    },

    bubbleLabel: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#bca1ff',
      marginBottom: '8px',
    },

    bubbleLabelUser: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#ecfeff',
      marginBottom: '8px',
    },

    bubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: isMobile ? '15px' : '15px',
      lineHeight: 1.55,
      color: '#f5f0ff',
    },

    userBubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: '15px',
      lineHeight: 1.55,
      color: '#ffffff',
    },

    inputCard: {
      background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.90) 0%, rgba(9, 14, 31, 0.84) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '14px' : '16px',
      boxShadow:
        '0 18px 42px rgba(0,0,0,0.26), 0 0 22px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },

    inputHeaderRow: {
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: '10px',
      flexWrap: 'wrap',
    },

    inputTitle: {
      fontSize: isMobile ? '18px' : '20px',
      fontWeight: 800,
      color: '#faf5ff',
      lineHeight: 1.1,
    },

    inputHint: {
      fontSize: '12px',
      color: '#cdbfff',
      lineHeight: 1.4,
      textAlign: 'right',
    },

    mainTextarea: {
      width: '100%',
      minHeight: isMobile ? '96px' : '118px',
      resize: 'vertical',
      borderRadius: '18px',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      background: 'rgba(255,255,255,0.04)',
      color: '#f5f0ff',
      padding: '14px 15px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: isMobile ? '15px' : '15px',
      lineHeight: 1.45,
    },

    inputFooter: {
      display: 'flex',
      alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexDirection: isMobile ? 'column' : 'row',
    },

    footerPrompt: {
      fontSize: '13px',
      lineHeight: 1.4,
      color: '#d7c7ff',
      flex: 1,
    },

    sendButton: {
      border: '1px solid rgba(206, 170, 255, 0.18)',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.28), rgba(84,248,255,0.10))',
      color: '#ffffff',
      padding: isMobile ? '12px 16px' : '12px 18px',
      borderRadius: '14px',
      fontSize: '15px',
      fontWeight: 800,
      minWidth: isMobile ? '100%' : '120px',
      boxShadow: '0 0 20px rgba(171,91,255,0.12)',
    },

    visualIdleCard: {
      position: 'relative',
      marginTop: '12px',
      borderRadius: '18px',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))',
      border: '1px solid rgba(255,255,255,0.06)',
    },

    visualIdleGlow: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(circle at 20% 20%, rgba(171,91,255,0.18), transparent 40%)',
      pointerEvents: 'none',
    },

    visualIdleInner: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px',
    },

    visualIdleLogo: {
      width: '52px',
      height: '52px',
      borderRadius: '14px',
      background: '#fff',
      objectFit: 'contain',
      padding: '4px',
      boxSizing: 'border-box',
      flexShrink: 0,
    },

    visualIdleTextWrap: {
      minWidth: 0,
    },

    visualIdleTitle: {
      fontSize: '14px',
      fontWeight: 800,
      color: '#faf5ff',
      marginBottom: '4px',
    },

    visualIdleText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: '#d8c7ff',
    },

    visualCard: {
      marginTop: '12px',
      borderRadius: '18px',
      background: '#ffffff',
      padding: '14px',
      color: '#111827',
      boxShadow: '0 10px 22px rgba(0,0,0,0.14)',
      overflow: 'hidden',
    },

    visualHeaderRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '12px',
      flexWrap: 'wrap',
    },

    visualTitle: {
      fontSize: '14px',
      fontWeight: 800,
      color: '#111827',
    },

    visualBadge: {
      fontSize: '11px',
      fontWeight: 800,
      color: '#6d28d9',
      background: '#f3e8ff',
      borderRadius: '999px',
      padding: '6px 10px',
    },

    visualDescription: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: '#334155',
      marginTop: '10px',
    },

    fractionBarWrap: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(22px, 1fr))',
      gap: '6px',
    },

    fractionPiece: {
      height: '36px',
      borderRadius: '10px',
      border: '1px solid rgba(148,163,184,0.18)',
    },

    numberLineWrap: {
      position: 'relative',
      paddingTop: '14px',
      paddingBottom: '4px',
    },

    numberLineBase: {
      position: 'absolute',
      top: '21px',
      left: '0',
      right: '0',
      height: '2px',
      background: '#cbd5e1',
    },

    numberLineRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(32px, 1fr))',
      gap: '4px',
      position: 'relative',
      zIndex: 1,
    },

    numberTickWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
    },

    numberDot: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
    },

    numberLabel: {
      fontSize: '12px',
      fontWeight: 600,
    },

    vocabWord: {
      fontSize: '22px',
      fontWeight: 800,
      color: '#111827',
      marginBottom: '8px',
    },

    vocabDefinition: {
      fontSize: '14px',
      lineHeight: 1.5,
      color: '#334155',
    },

    vocabExampleBox: {
      marginTop: '12px',
      padding: '12px',
      borderRadius: '14px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
    },

    vocabExampleLabel: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#6b7280',
      marginBottom: '6px',
    },

    vocabExampleText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: '#334155',
    },
  }
}
