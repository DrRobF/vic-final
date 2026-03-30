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
      text: 'I’m here to teach, not just answer. Type anything to begin or start a lesson below.',
      visual: {
        type: 'welcome',
        title: 'How VIC helps',
        items: [
          'Teaches step by step',
          'Uses examples and visuals',
          'Checks understanding',
        ],
      },
    },
  ])

  const messageAreaRef = useRef(null)
  const assistantMessageRefs = useRef({})
  const previousMessageCountRef = useRef(messages.length)

  const canGetReport = useMemo(() => messages.length > 1 && !loading, [messages.length, loading])

  useEffect(() => {
    const lastIndex = messages.length - 1
    const lastMessage = messages[lastIndex]

    if (!lastMessage || lastMessage.role !== 'assistant') {
      previousMessageCountRef.current = messages.length
      return
    }

    const container = messageAreaRef.current
    const target = assistantMessageRefs.current[lastIndex]

    if (!container || !target) {
      previousMessageCountRef.current = messages.length
      return
    }

    const scrollToNewestAssistant = () => {
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const offsetTop = targetRect.top - containerRect.top + container.scrollTop
      const idealTop = Math.max(offsetTop - 10, 0)

      container.scrollTo({
        top: idealTop,
        behavior: messages.length > previousMessageCountRef.current ? 'smooth' : 'auto',
      })
    }

    requestAnimationFrame(() => {
      scrollToNewestAssistant()
      setTimeout(scrollToNewestAssistant, 80)
    })

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

      const updatedMessages = [
        ...nextMessages,
        {
          role: 'assistant',
          text: finalReply,
          visual,
        },
      ]

      setMessages(updatedMessages)
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

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.brandBlock}>
            <div style={styles.logoImageWrap}>
              <img
                src="/vic-logo.png"
                alt="VIC Virtual Co-Teacher logo"
                style={styles.logoImage}
              />
            </div>

            <div style={styles.versionPill}>Brain {BRAIN_VERSION}</div>
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
                <span style={styles.statusText}>{loading ? 'Thinking' : 'Ready'}</span>
              </div>
            </div>

            <div style={styles.systemWrap}>
              <div ref={messageAreaRef} style={styles.messageArea}>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      if (msg.role === 'assistant') {
                        assistantMessageRefs.current[index] = el
                      }
                    }}
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
                <div style={styles.sectionHeaderRow}>
                  <div style={styles.sectionTitle}>Start a lesson</div>

                  <button
                    style={{
                      ...styles.reportButton,
                      opacity: canGetReport ? 1 : 0.6,
                      cursor: canGetReport ? 'pointer' : 'not-allowed',
                    }}
                    onClick={requestReport}
                    disabled={!canGetReport}
                  >
                    Get Report
                  </button>
                </div>

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

function VisualCardRenderer({ visual }) {
  if (!visual || !visual.type) return null

  if (visual.type === 'welcome') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Lesson support'}</div>
          <div style={styles.visualBadge}>Live visual</div>
        </div>

        <div style={styles.visualList}>
          {(visual.items || []).map((item, index) => (
            <div key={`${item}-${index}`} style={styles.visualListItem}>
              <span style={styles.visualListDot} />
              <span>{item}</span>
            </div>
          ))}
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

  if (visual.type === 'steps') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Step-by-step'}</div>
          <div style={styles.visualBadge}>Teacher board</div>
        </div>

        <div style={styles.stepList}>
          {(visual.steps || []).map((step, index) => (
            <div key={`${step}-${index}`} style={styles.stepRow}>
              <div style={styles.stepNumber}>{index + 1}</div>
              <div style={styles.stepText}>{step}</div>
            </div>
          ))}
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
    combined.includes('step by step') ||
    combined.includes('first') ||
    combined.includes('next') ||
    combined.includes('then') ||
    combined.includes('finally')
  ) {
    const parsedSteps = extractSteps(assistantText)

    if (parsedSteps.length >= 2) {
      return {
        type: 'steps',
        title: 'Let’s break it down',
        steps: parsedSteps.slice(0, 4),
      }
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

  return null
}

function extractSteps(text) {
  if (!text) return []

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const numberedLines = lines
    .map((line) => line.replace(/^\d+[\).\s-]+/, '').trim())
    .filter((line, index) => /^\d+[\).\s-]+/.test(lines[index]))

  if (numberedLines.length >= 2) return numberedLines

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  return sentences.filter((sentence) => sentence.length <= 120).slice(0, 4)
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
      'radial-gradient(circle at 20% 10%, rgba(124, 92, 255, 0.28), transparent 35%), radial-gradient(circle at 80% 90%, rgba(0, 255, 200, 0.20), transparent 40%), linear-gradient(135deg, #05070f 0%, #0b1224 50%, #0e1a2f 100%)',
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
    background: 'rgba(110, 92, 255, 0.18)',
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
    background: 'rgba(0, 255, 200, 0.12)',
    filter: 'blur(90px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  backgroundGlowThree: {
    position: 'absolute',
    top: '35%',
    right: '18%',
    width: '240px',
    height: '240px',
    background: 'rgba(70, 130, 255, 0.12)',
    filter: 'blur(80px)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  shell: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '88px 24px 32px',
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

  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '6px',
  },

  logoImageWrap: {
    width: '100%',
    maxWidth: '338px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '16px 16px 12px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(8px)',
  },

  logoImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    objectFit: 'contain',
    filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.18))',
  },

  versionPill: {
    alignSelf: 'flex-start',
    fontSize: '12px',
    fontWeight: 700,
    color: '#e4ebff',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    padding: '6px 10px',
  },

  heading: {
    fontSize: '56px',
    lineHeight: 1.02,
    margin: 0,
    marginBottom: '8px',
    fontWeight: 700,
    letterSpacing: '-0.035em',
    maxWidth: '580px',
    fontFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },

  taglinePrimary: {
    fontSize: '21px',
    lineHeight: 1.55,
    color: '#e3eaff',
    maxWidth: '540px',
    margin: 0,
    marginBottom: '8px',
    fontWeight: 500,
  },

  subheading: {
    fontSize: '18px',
    lineHeight: 1.65,
    color: '#c3d1ee',
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
    background: 'rgba(12, 19, 35, 0.78)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '28px',
    padding: '18px',
    boxShadow: '0 25px 80px rgba(0,0,0,0.38)',
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
    color: '#97adff',
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
      'linear-gradient(135deg, rgba(123,92,255,0.20), rgba(63,241,208,0.10))',
    border: '1px solid rgba(146, 151, 255, 0.32)',
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
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
    boxShadow: '0 10px 30px rgba(63, 241, 208, 0.20)',
  },

  subjectSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d7e3ff',
  },

  reportButton: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.10)',
    color: '#f7fbff',
    padding: '10px 14px',
    borderRadius: '14px',
    fontSize: '14px',
    fontWeight: 700,
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
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
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

  visualCard: {
    marginTop: '12px',
    padding: '12px',
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #dce7f4',
    borderRadius: '16px',
    boxShadow: '0 6px 18px rgba(15,23,42,0.06)',
  },

  visualHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },

  visualTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#1e293b',
  },

  visualBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#4338ca',
    background: 'rgba(124,92,255,0.10)',
    border: '1px solid rgba(124,92,255,0.18)',
    borderRadius: '999px',
    padding: '5px 8px',
  },

  visualDescription: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: '#475569',
  },

  visualList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  visualListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: '#334155',
    lineHeight: 1.45,
  },

  visualListDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#43e7d0',
    boxShadow: '0 0 0 4px rgba(67,231,208,0.15)',
    flexShrink: 0,
  },

  fractionBarWrap: {
    display: 'flex',
    gap: '6px',
    width: '100%',
  },

  fractionPiece: {
    flex: 1,
    height: '28px',
    borderRadius: '8px',
    border: '1px solid rgba(148,163,184,0.20)',
  },

  numberLineWrap: {
    position: 'relative',
    paddingTop: '8px',
    paddingBottom: '4px',
  },

  numberLineBase: {
    position: 'absolute',
    left: '12px',
    right: '12px',
    top: '20px',
    height: '3px',
    borderRadius: '999px',
    background: '#cbd5e1',
  },

  numberLineRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    position: 'relative',
  },

  numberTickWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '28px',
    position: 'relative',
    zIndex: 1,
  },

  numberDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: '2px solid #ffffff',
    marginBottom: '8px',
  },

  numberLabel: {
    fontSize: '12px',
  },

  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  stepRow: {
    display: 'grid',
    gridTemplateColumns: '30px 1fr',
    gap: '10px',
    alignItems: 'start',
  },

  stepNumber: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8f7cff 0%, #3ff1d0 100%)',
    color: '#07111e',
    fontWeight: 800,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#334155',
    paddingTop: '4px',
  },

  vocabWord: {
    fontSize: '22px',
    lineHeight: 1.2,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '6px',
  },

  vocabDefinition: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#334155',
  },

  vocabExampleBox: {
    marginTop: '10px',
    padding: '10px',
    borderRadius: '12px',
    background: '#eef6ff',
    border: '1px solid #d7e8fb',
  },

  vocabExampleLabel: {
    fontSize: '11px',
    letterSpacing: '0.12em',
    fontWeight: 800,
    color: '#355e9b',
    marginBottom: '6px',
  },

  vocabExampleText: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: '#334155',
  },
}
