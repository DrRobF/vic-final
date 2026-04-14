import { useEffect, useMemo, useRef, useState } from 'react'

const BRAIN_VERSION = 'v3.3'

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    text:
      'Let’s start learning 👇\n\nTry something like:\n• "Help me understand fractions"\n• "Give me a reading passage"\n\nOr pick a subject below to begin.',
    visual: { type: 'idle', title: 'Visual Support' },
  },
]

export default function AskVIC() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workArea, setWorkArea] = useState('')
  const [notes, setNotes] = useState('')
  const [activeTool, setActiveTool] = useState('practice')
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [viewportWidth, setViewportWidth] = useState(1400)
  const [lastReportText, setLastReportText] = useState(
    'No report yet. Run a short session and generate one to preview it here.'
  )
  const [selectedStudentId, setSelectedStudentId] = useState(2)
  const [sessionMode, setSessionMode] = useState('student_directed')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)

  function resetConversation() {
    setMessages(INITIAL_MESSAGES)
  }

  const messageAreaRef = useRef(null)
  const messageRefs = useRef([])
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)

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

  useEffect(() => {
    if (activeTool !== 'sketch') return

    const canvas = canvasRef.current
    if (!canvas) return

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(Math.floor(rect.width), 1)
      const height = Math.max(Math.floor(rect.height), 1)

      if (canvas.width === width && canvas.height === height) return

      const snapshot = document.createElement('canvas')
      snapshot.width = canvas.width || width
      snapshot.height = canvas.height || height
      const snapshotCtx = snapshot.getContext('2d')
      if (snapshotCtx && canvas.width && canvas.height) {
        snapshotCtx.drawImage(canvas, 0, 0)
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (snapshot.width && snapshot.height) {
        ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height)
      }
    }

    const raf = window.requestAnimationFrame(syncCanvasSize)
    window.addEventListener('resize', syncCanvasSize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', syncCanvasSize)
    }
  }, [activeTool, isCompact, isMobile, viewportWidth])

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
    const outgoing =
      typeof customMessage === 'string'
        ? customMessage
        : customMessage?.text || input
    const sketchImage =
      typeof customMessage === 'object' && customMessage?.sketchImage
        ? customMessage.sketchImage
        : null

    if (!outgoing.trim() || loading) return null

    const userTextForThread = sketchImage ? `${outgoing}

[Sketch attached]` : outgoing
    const userMessage = { role: 'user', text: userTextForThread }
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
body: JSON.stringify({
  messages: apiMessages,
  sketchImage,
  studentId: selectedStudentId,
  sessionMode,
})
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


  function startCanvasStroke(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = isErasingRef.current ? 18 : 3
    ctx.strokeStyle = isErasingRef.current ? '#ffffff' : '#000000'
    isDrawingRef.current = true
  }

  function moveCanvasStroke(e) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopCanvasStroke() {
    isDrawingRef.current = false
  }

  function setCanvasMode(mode) {
    isErasingRef.current = mode === 'erase'
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function discussSketch() {
    const canvas = canvasRef.current
    if (!canvas) return

    const sketchImage = canvas.toDataURL('image/png')
    await sendMessage({
      text:
        'Look at my sketch and respond like a calm teacher. First describe what you see in simple terms. Then tell me what looks correct, what might need fixing, and what I should try next.',
      sketchImage,
    })
  }

  function sendWorkspacePrompt(prompt) {
    setInput(prompt)
  }

  function requestHint() {
    const context =
      activeTool === 'practice'
        ? workArea.trim()
        : activeTool === 'notes'
          ? notes.trim()
          : ''

    const prompt = context
      ? `Give me a hint without giving away the full answer. Here is what I have so far:\n\n${context}`
      : activeTool === 'sketch'
        ? 'Help me think through my sketch. Ask me to describe what I drew and then guide me from there.'
        : 'Give me a hint for the problem I am working on without giving away the full answer.'

    sendWorkspacePrompt(prompt)
  }

  async function requestAskVICAboutThis() {
    const context =
      activeTool === 'practice'
        ? workArea.trim()
        : activeTool === 'notes'
          ? notes.trim()
          : ''

    if (!context) {
      const fallbackPrompt =
        activeTool === 'notes'
          ? 'I do not have notes written yet. Help me decide what notes I should take next.'
          : 'I do not have work written yet. Help me get started step by step.'

      await sendMessage(fallbackPrompt)
      return
    }

    const prompt =
      activeTool === 'notes'
        ? `Here are my notes. Respond like a patient teacher. Help me understand them, point out anything important or missing, and give me one next step:

${context}`
        : `Here is my work. Respond like a patient teacher. Say what is correct, what needs fixing, and give me one next step:

${context}`

    await sendMessage(prompt)
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
    </section>
  )


  const toolsSection = (
    <section style={styles.toolsCard}>
      <div style={styles.toolsHeaderRow}>
        <div style={styles.toolsHeaderText}>
          <div style={styles.sectionEyebrow}>Workspace</div>
          <div style={styles.sectionTitle}>Student Tools</div>
          <div style={styles.toolsSubtext}>Work while VIC teaches.</div>
        </div>
      </div>

      <div style={styles.toolTabsStickyWrap}>
        <div style={styles.toolTabsWrap}>
          <button
            style={activeTool === 'practice' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('practice')}
          >
            Practice
          </button>
          <button
            style={activeTool === 'sketch' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('sketch')}
          >
            Sketch
          </button>
          <button
            style={activeTool === 'notes' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('notes')}
          >
            Notes
          </button>
          <button
            style={activeTool === 'calculator' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('calculator')}
          >
            Calc
          </button>
        </div>
      </div>

      {activeTool === 'practice' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Practice</div>
            <div style={styles.practiceHintDarkText}>Work out your thinking here.</div>
          </div>

          <textarea
            value={workArea}
            onChange={(e) => setWorkArea(e.target.value)}
            placeholder="Work out your thinking here..."
            style={styles.sideTextarea}
          />
        </div>
      ) : null}

      {activeTool === 'sketch' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Sketch</div>
            <div style={styles.practiceHintDarkText}>
              Draw a model, label a science idea, or sketch out a math problem.
            </div>
          </div>

          <div style={styles.sketchToolbar}>
            <button style={styles.sketchToolButton} onClick={() => setCanvasMode('draw')}>
              Pen
            </button>
            <button style={styles.sketchToolButton} onClick={() => setCanvasMode('erase')}>
              Erase
            </button>
            <button style={styles.sketchToolButton} onClick={clearCanvas}>
              Clear
            </button>
          </div>
                 <div style={styles.sketchCanvasWrap}>
            <button
              type="button"
              style={styles.sketchExpandButton}
              onClick={() => setSketchExpanded(!sketchExpanded)}
            >
              {sketchExpanded ? 'Close Large Pad' : 'Open Large Pad'}
            </button>

            <canvas
              ref={canvasRef}
              style={styles.sketchCanvas}
              onPointerDown={startCanvasStroke}
              onPointerMove={moveCanvasStroke}
              onPointerUp={stopCanvasStroke}
              onPointerLeave={stopCanvasStroke}
            />
          </div>
        </div>
      ) : null}

      {activeTool === 'notes' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Notes</div>
            <div style={styles.practiceHintDarkText}>Save the important ideas cleanly here.</div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Save important ideas here..."
            style={styles.notesTextareaLarge}
          />
        </div>
      ) : null}

      {activeTool === 'notes' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>
            Ask VIC About This
          </button>
        </div>
      ) : null}

      {activeTool === 'calculator' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Calculator</div>
            <div style={styles.practiceHintDarkText}>Use it when it helps — not before you think.</div>
          </div>

          <div style={styles.toolPanelWhite}>
            <input
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder="Example: 12 * (4 + 3)"
              style={styles.calcInput}
            />
            <div style={styles.calcRow}>
              <button style={styles.smallButtonDark} onClick={runCalculator}>
                Calculate
              </button>
              <div style={styles.calcResultDark}>{calcResult || 'Result will appear here.'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTool === 'practice' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>
            Ask VIC About This
          </button>
        </div>
      ) : null}

      {activeTool === 'sketch' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={discussSketch}>
            Discuss My Sketch
          </button>
        </div>
      ) : null}

      <div style={styles.reportFeatureCardCompact}>
        <div style={styles.reportFeatureTopCompact}>
          <div>
            <div style={styles.reportFeatureLabelCompact}>Session Report</div>
            <div style={styles.reportFeatureTitleCompact}>Download the session summary</div>
          </div>

          <button
            style={canGetReport ? styles.reportButtonCompact : styles.reportButtonDisabledCompact}
            onClick={requestReport}
            disabled={!canGetReport}
          >
            Get Report
          </button>
        </div>

        <div style={styles.reportFeatureTextCompact}>
          Generate a clean summary when the session is finished.
        </div>

        <div style={styles.reportPreviewInline}>
          <div style={styles.reportPreviewInlineLabel}>Last Report Preview</div>
          <div style={styles.reportPreviewInlineText}>{lastReportText}</div>
        </div>
      </div>
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
          <div style={styles.topNavLeft}>
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
              <a href="/" style={styles.navLinkCurrent}>
                Ask VIC
              </a>
              <a href="/reports" style={styles.navLinkPrimary}>
                Progress
              </a>
              <a href="/about" style={styles.navLink}>
                About
              </a>
            </nav>
          </div>

          <div style={styles.topNavRight}>
            <div style={styles.headerBadge}>Brain {BRAIN_VERSION}</div>
          </div>
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

              <div style={styles.quickStartInline}>
                <div style={styles.quickStartInlineLabel}>Quick starts</div>
            <select
  value={selectedStudentId}
onChange={(e) => {
  setSelectedStudentId(Number(e.target.value))
  resetConversation()
}}
  style={{
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    marginBottom: '10px',
  }}
>
  <option value={2}>Jake Student</option>
  <option value={3}>Maya Student</option>
</select>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
  <button
    style={styles.quickStartPill}
   onClick={() => {
  setSessionMode('teacher_directed')
  resetConversation()
}}
  >
    My Assigned Lesson
  </button>

  <button
    style={styles.quickStartPill}
   onClick={() => {
  setSessionMode('student_directed')
  resetConversation()
}}
  >
    Ask VIC Freely
  </button>
</div>

<div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '10px' }}>
  Current mode: {sessionMode === 'teacher_directed' ? 'Assigned Lesson' : 'Free Ask VIC'}
</div>
                <div style={styles.quickStartInlineButtons}>
                  <button style={styles.quickStartPill} onClick={() => startSubject('math')}>Math</button>
                  <button style={styles.quickStartPill} onClick={() => startSubject('reading')}>Reading</button>
                  <button style={styles.quickStartPill} onClick={() => startSubject('writing')}>Writing</button>
                  <button style={styles.quickStartPill} onClick={() => startSubject('science')}>Science</button>
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
  const desktopFixedHeight = !isCompact

  return {
    page: {
      height: desktopFixedHeight ? '100vh' : 'auto',
      minHeight: '100vh',
      background:
        'radial-gradient(circle at 14% 8%, rgba(171, 91, 255, 0.38), transparent 24%), radial-gradient(circle at 82% 84%, rgba(171, 91, 255, 0.18), transparent 26%), radial-gradient(circle at 50% 20%, rgba(247, 95, 255, 0.14), transparent 28%), radial-gradient(circle at 78% 72%, rgba(140, 88, 255, 0.14), transparent 26%), linear-gradient(135deg, #070312 0%, #17092b 44%, #10061d 100%)',
      color: '#f2edff',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: desktopFixedHeight ? 'hidden' : 'visible',
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
      height: desktopFixedHeight ? '100vh' : 'auto',
      margin: '0 auto',
      padding: isMobile ? '14px' : '18px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '14px' : '18px',
    },

    topNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexShrink: 0,
      flexWrap: 'wrap',
      padding: isMobile ? '12px 14px' : '14px 18px',
      borderRadius: '22px',
      background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.86) 0%, rgba(9, 14, 31, 0.78) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      boxShadow:
        '0 14px 36px rgba(0,0,0,0.24), 0 0 24px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(14px)',
    },

    topNavLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '12px' : '18px',
      flexWrap: 'wrap',
      minWidth: 0,
      flex: 1,
    },

    topNavRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
      marginLeft: 'auto',
    },

    headerBadge: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#f5ebff',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.22), rgba(84,248,255,0.12))',
      border: '1px solid rgba(203, 166, 255, 0.24)',
      boxShadow: '0 0 16px rgba(171,91,255,0.12)',
      whiteSpace: 'nowrap',
    },

    brandLink: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
      color: '#faf5ff',
      minWidth: 0,
      flexShrink: 0,
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
      gap: '8px',
      flexWrap: 'wrap',
      minWidth: 0,
    },

    navLink: {
      textDecoration: 'none',
      color: '#eadcff',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      whiteSpace: 'nowrap',
    },

    navLinkPrimary: {
      textDecoration: 'none',
      color: '#f9f5ff',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(171,91,255,0.24), rgba(84,248,255,0.10))',
      border: '1px solid rgba(203, 166, 255, 0.24)',
      boxShadow: '0 0 18px rgba(171,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
      whiteSpace: 'nowrap',
    },

    navLinkCurrent: {
      textDecoration: 'none',
      color: '#ffffff',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      whiteSpace: 'nowrap',
    },

    shell: {
      flex: 1,
      minHeight: 0,
      overflow: 'visible',
      display: 'grid',
      gridTemplateColumns: isCompact ? '1fr' : '420px minmax(0, 1fr)',
      gap: isMobile ? '14px' : '18px',
      overflow: desktopFixedHeight ? 'hidden' : 'visible',
    },

    leftColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      gap: '18px',
      overflow: 'hidden',
    },

    rightColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: isCompact ? 'auto minmax(320px, 1fr) auto auto' : 'minmax(0, 1fr) auto',
      gap: isMobile ? '14px' : '14px',
      overflow: 'hidden',
    },

    heroCard: {
      background: 'linear-gradient(180deg, rgba(18, 8, 38, 0.92) 0%, rgba(10, 15, 35, 0.84) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.18)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '16px' : '16px',
      boxShadow:
        '0 20px 52px rgba(0,0,0,0.28), 0 0 28px rgba(171, 91, 255, 0.10), inset 0 1px 0 rgba(255,255,255,0.05)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
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
      gridTemplateColumns: isMobile ? '1fr' : '86px 1fr',
      gap: isMobile ? '12px' : '14px',
      alignItems: isMobile ? 'start' : 'center',
    },

    logoImageWrap: {
      width: isMobile ? '82px' : '86px',
      height: isMobile ? '82px' : '86px',
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
      fontSize: isMobile ? '24px' : isTablet ? '25px' : '26px',
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
      fontSize: isMobile ? '13px' : '14px',
      lineHeight: 1.35,
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
      fontSize: isMobile ? '16px' : '17px',
      fontWeight: 800,
      color: '#faf5ff',
      marginTop: '0',
      lineHeight: 1.1,
    },

    subjectGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
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

    quickStartInline: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '10px',
      padding: '0 4px 4px 4px',
    },

    quickStartInlineLabel: {
      fontSize: '12px',
      fontWeight: 800,
      color: '#d8c7ff',
      whiteSpace: 'nowrap',
    },

    quickStartInlineButtons: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },

    quickStartPill: {
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: '#f8f4ff',
      padding: '8px 12px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
      gap: '10px',
      overflowY: 'auto',
      flex: 1,
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
      fontSize: '12px',
      color: '#d7c7ff',
      lineHeight: 1.3,
      marginTop: '4px',
    },

    toolTabsStickyWrap: {
      position: 'sticky',
      top: 0,
      zIndex: 6,
      background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.98) 0%, rgba(16, 8, 34, 0.90) 100%)',
      paddingTop: '2px',
      paddingBottom: '2px',
    },

    toolTabsWrap: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
      gap: '8px',
    },

    toolTab: {
      background: '#ffffff',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      color: '#24163f',
      padding: '12px 8px',
      borderRadius: '15px',
      fontSize: isMobile ? '14px' : '13px',
      lineHeight: 1,
      fontWeight: 800,
      cursor: 'pointer',
    },

    toolTabActive: {
      background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(240,244,255,1) 100%)',
      border: '2px solid rgba(126, 92, 255, 0.50)',
      color: '#1d1236',
      padding: '12px 8px',
      borderRadius: '15px',
      fontSize: isMobile ? '14px' : '13px',
      lineHeight: 1,
      fontWeight: 800,
      boxShadow: '0 10px 22px rgba(0,0,0,0.16), 0 0 0 1px rgba(126,92,255,0.08)',
      cursor: 'pointer',
    },

    workspacePanel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flexShrink: 0,
      minHeight: 0,
    },

    supportRowTwoUp: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '10px',
      flexShrink: 0,
      position: 'relative',
    },

    supportRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
      gap: '10px',
    },

    supportButton: {
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(171,91,255,0.05))',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      color: '#f3edff',
      padding: '11px 12px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    supportButtonActive: {
      background:
        'linear-gradient(135deg, rgba(171,91,255,0.24) 0%, rgba(84,248,255,0.10) 100%)',
      border: '1px solid rgba(206, 170, 255, 0.24)',
      color: '#ffffff',
      padding: '11px 12px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 800,
      boxShadow: '0 10px 22px rgba(0,0,0,0.16), 0 0 0 1px rgba(126,92,255,0.08)',
      cursor: 'pointer',
    },

    sketchToolbar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      flexShrink: 0,
    },

      sketchCanvasWrap: {
      width: '100%',
      minHeight: isMobile ? '340px' : sketchExpanded ? '78vh' : '560px',
      height: isMobile ? '340px' : sketchExpanded ? '78vh' : '560px',
      maxHeight: isMobile ? '340px' : '900px',
      borderRadius: '18px',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#ffffff',
      overflow: 'hidden',
      boxSizing: 'border-box',
      flexShrink: 0,
      position: 'relative',
      zIndex: 1,
    },
    supportButtonWhiteStrong: {
      background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(244,247,255,1) 100%)',
      border: '2px solid rgba(126, 92, 255, 0.45)',
      color: '#1d1236',
      padding: '12px 14px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 10px 22px rgba(0,0,0,0.14)',
    },

    sketchToolButton: {
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#ffffff',
      color: '#24163f',
      padding: '9px 12px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    sketchExpandButton: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 3,
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: 'rgba(255,255,255,0.96)',
      color: '#24163f',
      padding: '8px 10px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    },
    sketchCanvas: {
      width: '100%',
      height: '100%',
      display: 'block',
      background: '#ffffff',
      touchAction: 'none',
      boxSizing: 'border-box',
    },

    toolStripCard: {
      borderRadius: '18px',
      padding: '14px',
      background:
        'linear-gradient(135deg, rgba(171,91,255,0.10), rgba(84,248,255,0.04))',
      border: '1px solid rgba(206, 170, 255, 0.14)',
      boxShadow: '0 0 18px rgba(171,91,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    toolStripHeader: {
      display: 'flex',
      alignItems: 'start',
      justifyContent: 'space-between',
      gap: '10px',
    },

    toolStripLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#dbc1ff',
      fontWeight: 800,
      marginBottom: '4px',
    },

    toolStripTitle: {
      fontSize: '17px',
      lineHeight: 1.1,
      fontWeight: 800,
      color: '#fff8ff',
    },


    reportFeatureCardCompact: {
      borderRadius: '18px',
      padding: '14px',
      marginTop: '4px',
      background: 'linear-gradient(180deg, rgba(27, 16, 52, 0.98) 0%, rgba(18, 13, 38, 0.98) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
      zIndex: 2,
      overflow: 'hidden',
      flexShrink: 0,
    },

    reportFeatureTopCompact: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
      gap: '12px',
      alignItems: 'start',
    },

    reportFeatureLabelCompact: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#dbc1ff',
      fontWeight: 800,
      marginBottom: '4px',
    },

    reportFeatureTitleCompact: {
      fontSize: '16px',
      lineHeight: 1.1,
      fontWeight: 800,
      color: '#fff8ff',
    },

    reportFeatureTextCompact: {
      fontSize: '13px',
      lineHeight: 1.5,
      color: '#dccfff',
    },

    reportPreviewInline: {
      paddingTop: '6px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },

    reportPreviewInlineLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontWeight: 800,
      color: '#cdb8f5',
    },

    reportPreviewInlineText: {
      fontSize: '12px',
      lineHeight: 1.45,
      color: '#e8dcff',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
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
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
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
      boxShadow: '0 10px 22px rgba(0,0,0,0.16), 0 0 0 1px rgba(126,92,255,0.08)',
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

    practiceHintDarkText: {
      fontSize: '12px',
      color: '#5b6072',
      lineHeight: 1.4,
    },

    miniLabel: {
      fontSize: '13px',
      fontWeight: 800,
      color: '#faf5ff',
    },

    miniLabelDarkText: {
      fontSize: '13px',
      fontWeight: 800,
      color: '#24163f',
    },

    miniLabelDark: {
      fontSize: '13px',
      fontWeight: 800,
      color: '#f3edff',
      marginBottom: '8px',
    },

    sideTextarea: {
      width: '100%',
      minHeight: isMobile ? '160px' : '220px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#ffffff',
      color: '#24163f',
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

    toolPanelWhite: {
      borderRadius: '18px',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#ffffff',
      padding: '14px',
      boxShadow: '0 12px 26px rgba(0,0,0,0.12)',
    },

    calcInput: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#f8f9fc',
      color: '#24163f',
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

    smallButtonDark: {
      border: '1px solid rgba(126, 92, 255, 0.28)',
      background: 'linear-gradient(135deg, rgba(126,92,255,0.12), rgba(84,248,255,0.06))',
      color: '#24163f',
      padding: '10px 14px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    calcResultDark: {
      minHeight: '20px',
      fontSize: '14px',
      color: '#4b5568',
      wordBreak: 'break-word',
    },


    notesTextareaLarge: {
      width: '100%',
      minHeight: isMobile ? '160px' : '220px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid rgba(216, 220, 235, 0.95)',
      background: '#ffffff',
      color: '#24163f',
      padding: '14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
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
      minHeight: isCompact ? '320px' : 0,
      background: 'linear-gradient(180deg, rgba(12, 8, 26, 0.92) 0%, rgba(9, 14, 31, 0.88) 100%)',
      border: '1px solid rgba(191, 141, 255, 0.16)',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '14px' : '14px',
      boxShadow:
        '0 24px 60px rgba(0,0,0,0.30), 0 0 26px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
      minHeight: 0,
    },

    chatHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      marginBottom: '8px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
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
      overflow: 'hidden',
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
      padding: isMobile ? '14px' : '14px',
      boxShadow:
        '0 18px 42px rgba(0,0,0,0.26), 0 0 22px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flexShrink: 0,
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
      minHeight: isMobile ? '84px' : '80px',
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
