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
  const [lastReportText, setLastReportText] = useState(
    'No report yet. Run a short session and generate one to preview it here.'
  )

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
      setLastReportText(finalReply.slice(0, 280) + (finalReply.length > 280 ? '...' : ''))
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

  const styles = buildStyles({ isMobile, isTablet, isCompact })

  const heroSection = (
    <section style={styles.heroCard}>
      <div style={styles.heroSparkle} />

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
        <div style={styles.quickStartText}>
          Pick a subject or ask a question. VIC works best one thought at a time.
        </div>

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
            <span style={styles.subjectButtonSub}>Explore step by step</span>
          </button>
        </div>
      </div>
    </section>
  )

  const toolsSection = (
    <section style={styles.toolsCard}>
      <div style={styles.toolsHeaderRow}>
        <div style={styles.toolsHeaderText}>
          <div style={styles.sectionEyebrow}>Workspace Tools</div>
          <div style={styles.sectionTitle}>Practice, notes, and report</div>
          <div style={styles.toolsSubtext}>
            Keep your work here while VIC teaches.
          </div>
        </div>
      </div>

      <div style={styles.reportFeatureCard}>
        <div style={styles.reportFeatureTop}>
          <div>
            <div style={styles.reportFeatureLabel}>Featured Tool</div>
            <div style={styles.reportFeatureTitle}>Reports</div>
          </div>

          <button
            style={canGetReport ? styles.reportButton : styles.reportButtonDisabled}
            onClick={requestReport}
            disabled={!canGetReport}
          >
            Get Report
          </button>
        </div>

        <div style={styles.reportFeatureText}>
          Turn a VIC session into a clean downloadable summary of what was taught and practiced.
        </div>

        <div style={styles.reportPreviewCard}>
          <div style={styles.reportPreviewLabel}>Last Report Preview</div>
          <div style={styles.reportPreviewText}>{lastReportText}</div>
        </div>
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
  )

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />
      <div style={styles.backgroundGlowThree} />
      <div style={styles.backgroundGlowFour} />
      <div style={styles.backgroundMesh} />
      <div style={styles.backgroundSweep} />

      <div style={styles.appFrame}>
        <header style={styles.topNav}>
          <a href="/" style={styles.brandLink}>
            <div style={styles.brandLogoWrap}>
              <img src="/vic-logo.png" alt="VIC logo" style={styles.brandLogoImage} />
            </div>

            <div style={styles.brandTextWrap}>
              <div style={styles.brandTitle}>VIC</div>
              <div style={styles.brandSub}>Your AI co-teacher</div>
            </div>
          </a>

          <nav style={styles.navLinks}>
            <a href="/reports" style={styles.navLink}>
              Reports
            </a>
            <a href="/about" style={styles.navLink}>
              About
            </a>
          </nav>
        </header>

        <div style={styles.shell}>
          {!isCompact ? (
            <div style={styles.leftColumn}>
              {heroSection}
              {toolsSection}
            </div>
          ) : null}

          <div style={styles.rightColumn}>
            {isCompact ? heroSection : null}

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
                          msg.role === 'assistant'
                            ? styles.bubbleLabel
                            : styles.bubbleLabelUser
                        }
                      >
                        {msg.role === 'assistant' ? 'VIC' : 'You'}
                      </div>

                      <p
                        style={
                          msg.role === 'assistant'
                            ? styles.bubbleText
                            : styles.userBubbleText
                        }
                      >
                        {msg.text}
                      </p>

                      {msg.role === 'assistant' && msg.visual ? (
                        <VisualCardRenderer visual={msg.visual} styles={styles} />
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

                {!isMobile ? (
                  <div style={styles.inputHint}>Enter = send • Shift + Enter = new line</div>
                ) : null}
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={isMobile ? 3 : 3}
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

    brandLogoWrap: {
      width: isMobile ? '42px' : '46px',
      height: isMobile ? '42px' : '46px',
      borderRadius: '14px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,238,255,0.96) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.78), 0 8px 18px rgba(0,0,0,0.18), 0 0 18px rgba(171, 91, 255, 0.10)',
      flexShrink: 0,
    },

    brandLogoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      transform: 'scale(1.18)',
      background: '#fff',
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
      gap: '10px',
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
      gridTemplateRows: 'minmax(0, 1.02fr) minmax(0, 0.98fr)',
      gap: '18px',
    },

    rightColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: isCompact ? 'auto minmax(340px, 1fr) auto auto' : 'minmax(0, 1fr) auto',
      gap: isMobile ? '14px' : '16px',
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
      gridTemplateColumns: isMobile ? '1fr' : '102px 1fr',
      gap: isMobile ? '12px' : '14px',
      alignItems: isMobile ? 'start' : 'center',
    },

    logoImageWrap: {
      width: isMobile ? '88px' : '100px',
      height: isMobile ? '88px' : '100px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,238,255,0.96) 100%)',
      borderRadius: '22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 28px rgba(0,0,0,0.22), 0 0 20px rgba(171, 91, 255, 0.12)',
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
      fontFamily:
        '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    },

    tagline: {
      margin: 0,
      fontSize: isMobile ? '14px' : '15px',
      lineHeight: 1.4,
      color: '#dccbff',
      maxWidth: '420px',
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
      gridTemplateColumns: '1fr 1fr',
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
      gridTemplateColumns: '1fr',
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

    reportFeatureCard: {
      borderRadius: '20px',
      padding: '16px',
      background:
        'linear-gradient(135deg, rgba(171,91,255,0.16), rgba(84,248,255,0.06))',
      border: '1px solid rgba(206, 170, 255, 0.18)',
      boxShadow: '0 0 22px rgba(171,91,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    reportFeatureTop: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
      gap: '12px',
      alignItems: 'start',
    },

    reportFeatureLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#dbc1ff',
      fontWeight: 800,
      marginBottom: '4px',
    },

    reportFeatureTitle: {
      fontSize: '20px',
      lineHeight: 1.05,
      fontWeight: 800,
      color: '#fff8ff',
    },

    reportFeatureText: {
      fontSize: '14px',
      lineHeight: 1.55,
      color: '#f3eaff',
    },

    reportPreviewCard: {
      marginTop: '4px',
      padding: '12px 13px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.08)',
    },

    reportPreviewLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontWeight: 800,
      color: '#e7d7ff',
      marginBottom: '8px',
    },

    reportPreviewText: {
      fontSize: '13px',
      lineHeight: 1.5,
      color: '#f7f0ff',
    },

    reportButton: {
      border: '1px solid rgba(206, 170, 255, 0.24)',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(171,91,255,0.12))',
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
      minHeight: isCompact ? '340px' : 0,
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
      marginBottom: '10px',
      paddingBottom: '8px',
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
      background: '#f7f7fb',
      borderRadius: '22px',
      padding: isMobile ? '12px' : '14px',
      border: '1px solid rgba(213, 218, 232, 0.8)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
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
      background: 'linear-gradient(180deg, #2b2448 0%, #231d3e 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '14px 15px',
      boxShadow: '0 10px 22px rgba(17,24,39,0.14)',
    },

    userBubble: {
      alignSelf: 'flex-end',
      maxWidth: isMobile ? '94%' : '78%',
      borderRadius: '20px 20px 8px 20px',
      background: '#e8ecf8',
      border: '1px solid #d8def0',
      padding: '14px 15px',
      boxShadow: '0 10px 20px rgba(17,24,39,0.08)',
    },

    bubbleLabel: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#c7b2ff',
      marginBottom: '8px',
    },

    bubbleLabelUser: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#475569',
      marginBottom: '8px',
    },

    bubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: '15px',
      lineHeight: 1.55,
      color: '#ffffff',
    },

    userBubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: '15px',
      lineHeight: 1.55,
      color: '#1e293b',
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
      gap: '10px',
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
      minHeight: isMobile ? '84px' : '94px',
      resize: 'vertical',
      borderRadius: '18px',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      background: '#ffffff',
      color: '#1e293b',
      padding: '14px 15px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '15px',
      lineHeight: 1.45,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
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
      background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
      border: '1px solid rgba(255,255,255,0.08)',
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
