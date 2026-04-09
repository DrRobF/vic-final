import { useEffect, useMemo, useRef, useState } from 'react'

const BRAIN_VERSION = 'v3.4'

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
  const [canvasMode, setCanvasMode] = useState('draw')
  const [isSketchExpanded, setIsSketchExpanded] = useState(false)

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
  const canvasRef = useRef(null)
  const expandedCanvasRef = useRef(null)
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
    isErasingRef.current = canvasMode === 'erase'
  }, [canvasMode])

  useEffect(() => {
    const activeCanvas = isSketchExpanded ? expandedCanvasRef.current : canvasRef.current
    if (!activeCanvas) return
    initializeCanvas(activeCanvas)
  }, [isSketchExpanded, activeTool])

  useEffect(() => {
    if (activeTool !== 'sketch') return

    const syncAllCanvases = () => {
      syncCanvasSize(canvasRef.current)
      syncCanvasSize(expandedCanvasRef.current)
    }

    const raf = window.requestAnimationFrame(syncAllCanvases)
    window.addEventListener('resize', syncAllCanvases)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', syncAllCanvases)
    }
  }, [activeTool, isSketchExpanded, viewportWidth])

  useEffect(() => {
    if (!isSketchExpanded) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsSketchExpanded(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isSketchExpanded])

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

  function initializeCanvas(canvas) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!canvas.dataset.initialized) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width || 1, canvas.height || 1)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      canvas.dataset.initialized = 'true'
    }
  }

  function syncCanvasSize(canvas) {
    if (!canvas) return

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

  function copyCanvas(sourceCanvas, targetCanvas) {
    if (!sourceCanvas || !targetCanvas) return
    syncCanvasSize(targetCanvas)
    const targetCtx = targetCanvas.getContext('2d')
    if (!targetCtx) return

    targetCtx.fillStyle = '#ffffff'
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height)
    targetCtx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, targetCanvas.width, targetCanvas.height)
  }

  function openExpandedSketch() {
    setIsSketchExpanded(true)
    requestAnimationFrame(() => {
      syncCanvasSize(expandedCanvasRef.current)
      copyCanvas(canvasRef.current, expandedCanvasRef.current)
    })
  }

  function closeExpandedSketch(saveChanges = true) {
    if (saveChanges) {
      syncCanvasSize(canvasRef.current)
      copyCanvas(expandedCanvasRef.current, canvasRef.current)
    }
    setIsSketchExpanded(false)
  }

  async function sendMessage(customMessage) {
    const outgoing = typeof customMessage === 'string' ? customMessage : customMessage?.text || input
    const sketchImage = typeof customMessage === 'object' && customMessage?.sketchImage ? customMessage.sketchImage : null

    if (!outgoing.trim() || loading) return null

    const userTextForThread = sketchImage ? `${outgoing}\n\n[Sketch attached]` : outgoing
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
        body: JSON.stringify({ messages: apiMessages, sketchImage }),
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

  function getPointFromEvent(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startCanvasStroke(e, target = 'main') {
    const canvas = target === 'expanded' ? expandedCanvasRef.current : canvasRef.current
    if (!canvas) return

    syncCanvasSize(canvas)
    const { x, y } = getPointFromEvent(e, canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = isErasingRef.current ? 20 : 3
    ctx.strokeStyle = isErasingRef.current ? '#ffffff' : '#000000'
    isDrawingRef.current = true
  }

  function moveCanvasStroke(e, target = 'main') {
    if (!isDrawingRef.current) return

    const canvas = target === 'expanded' ? expandedCanvasRef.current : canvasRef.current
    if (!canvas) return

    const { x, y } = getPointFromEvent(e, canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopCanvasStroke() {
    isDrawingRef.current = false
  }

  function clearCanvas(target = 'both') {
    const canvases =
      target === 'main'
        ? [canvasRef.current]
        : target === 'expanded'
          ? [expandedCanvasRef.current]
          : [canvasRef.current, expandedCanvasRef.current]

    canvases.forEach((canvas) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    })
  }

  async function discussSketch() {
    const sourceCanvas = isSketchExpanded ? expandedCanvasRef.current : canvasRef.current
    if (!sourceCanvas) return

    if (isSketchExpanded) {
      copyCanvas(expandedCanvasRef.current, canvasRef.current)
    }

    const sketchImage = sourceCanvas.toDataURL('image/png')
    await sendMessage({
      text:
        'You are a patient teacher. Describe what you see. Say what is correct. Say what needs fixing. Give one next step.',
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

  function requestCheckMyWork() {
    const context =
      activeTool === 'practice'
        ? workArea.trim()
        : activeTool === 'notes'
          ? notes.trim()
          : ''

    const prompt = context
      ? `Check my work and tell me what is right, what needs fixing, and what to try next:\n\n${context}`
      : activeTool === 'sketch'
        ? 'I made a sketch in my workspace. Ask me to describe it and then help me check whether the idea makes sense.'
        : 'Help me check my work step by step.'

    sendWorkspacePrompt(prompt)
  }

  const styles = buildStyles({ isMobile, isTablet, isCompact, isSketchExpanded })

  const heroSection = (
    <section style={styles.heroCard}>
      <div style={styles.heroSparkle} />
      <div style={styles.heroTop}>
        <div style={styles.logoImageWrap}>
          <img src="/vic-logo.png" alt="VIC Virtual Co-Teacher logo" style={styles.logoImage} />
        </div>

        <div style={styles.heroTextWrap}>
          <div style={styles.versionPill}>Brain {BRAIN_VERSION}</div>
          <h1 style={styles.heading}>More than answers. Real teaching.</h1>
          <p style={styles.tagline}>Guided help that feels calm, clear, and personal.</p>
        </div>
      </div>
    </section>
  )

  const sketchWorkspace = (
    <div style={styles.workspacePanel}>
      <div style={styles.practiceHeaderRow}>
        <div>
          <div style={styles.miniLabelDarkText}>Sketch</div>
          <div style={styles.practiceHintDarkText}>
            Draw a model, label a science idea, or sketch out a math problem.
          </div>
        </div>
        <button style={styles.expandSketchButton} onClick={openExpandedSketch}>
          Expand Sketch
        </button>
      </div>

      <div style={styles.sketchCanvasWrap}>
        <canvas
          ref={canvasRef}
          style={styles.sketchCanvas}
          onPointerDown={(e) => startCanvasStroke(e, 'main')}
          onPointerMove={(e) => moveCanvasStroke(e, 'main')}
          onPointerUp={stopCanvasStroke}
          onPointerLeave={stopCanvasStroke}
        />
      </div>

      <div style={styles.sketchToolbarBelow}>
        <button
          style={canvasMode === 'draw' ? styles.sketchToolButtonActive : styles.sketchToolButton}
          onClick={() => setCanvasMode('draw')}
        >
          Pen
        </button>
        <button
          style={canvasMode === 'erase' ? styles.sketchToolButtonActive : styles.sketchToolButton}
          onClick={() => setCanvasMode('erase')}
        >
          Erase
        </button>
        <button style={styles.sketchToolButton} onClick={() => clearCanvas('both')}>
          Clear
        </button>
      </div>
    </div>
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
          <button style={activeTool === 'practice' ? styles.toolTabActive : styles.toolTab} onClick={() => setActiveTool('practice')}>
            Practice
          </button>
          <button style={activeTool === 'sketch' ? styles.toolTabActive : styles.toolTab} onClick={() => setActiveTool('sketch')}>
            Sketch
          </button>
          <button style={activeTool === 'notes' ? styles.toolTabActive : styles.toolTab} onClick={() => setActiveTool('notes')}>
            Notes
          </button>
          <button style={activeTool === 'calculator' ? styles.toolTabActive : styles.toolTab} onClick={() => setActiveTool('calculator')}>
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

      {activeTool === 'sketch' ? sketchWorkspace : null}

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
          <button style={styles.supportButtonWhite} onClick={requestHint}>Hint</button>
          <button style={styles.supportButtonWhiteStrong} onClick={requestCheckMyWork}>Check My Work</button>
        </div>
      ) : null}

      {activeTool === 'sketch' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>Hint</button>
          <button style={styles.supportButtonWhiteStrong} onClick={discussSketch}>Discuss My Sketch</button>
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
              <a href="/" style={styles.navLinkCurrent}>Ask VIC</a>
              <a href="/reports" style={styles.navLinkPrimary}>Progress</a>
              <a href="/about" style={styles.navLink}>About</a>
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
                      <div style={msg.role === 'assistant' ? styles.bubbleLabel : styles.bubbleLabelUser}>
                        {msg.role === 'assistant' ? 'VIC' : 'You'}
                      </div>

                      <p style={msg.role === 'assistant' ? styles.bubbleText : styles.userBubbleText}>
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
                rows={3}
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

      {isSketchExpanded ? (
        <div style={styles.sketchOverlay}>
          <div style={styles.sketchOverlayCard}>
            <div style={styles.sketchOverlayHeader}>
              <div>
                <div style={styles.overlayTitle}>Expanded Sketch</div>
                <div style={styles.overlayText}>A larger workspace so students can sketch clearly before VIC evaluates it.</div>
              </div>
              <button style={styles.closeOverlayButton} onClick={() => closeExpandedSketch(true)}>
                Done
              </button>
            </div>

            <div style={styles.sketchOverlayCanvasWrap}>
              <canvas
                ref={expandedCanvasRef}
                style={styles.sketchOverlayCanvas}
                onPointerDown={(e) => startCanvasStroke(e, 'expanded')}
                onPointerMove={(e) => moveCanvasStroke(e, 'expanded')}
                onPointerUp={stopCanvasStroke}
                onPointerLeave={stopCanvasStroke}
              />
            </div>

            <div style={styles.sketchOverlayToolbar}>
              <button
                style={canvasMode === 'draw' ? styles.sketchToolButtonActive : styles.sketchToolButton}
                onClick={() => setCanvasMode('draw')}
              >
                Pen
              </button>
              <button
                style={canvasMode === 'erase' ? styles.sketchToolButtonActive : styles.sketchToolButton}
                onClick={() => setCanvasMode('erase')}
              >
                Erase
              </button>
              <button style={styles.sketchToolButton} onClick={() => clearCanvas('expanded')}>
                Clear
              </button>
              <button style={styles.overlayGhostButton} onClick={discussSketch}>
                Discuss My Sketch
              </button>
              <button style={styles.overlayGhostButton} onClick={() => closeExpandedSketch(true)}>
                Save & Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
            <div style={styles.visualIdleText}>Diagrams, models, and step visuals show up only when they help.</div>
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
          <div style={styles.visualBadge}>{numerator}/{denominator}</div>
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

        <div style={styles.visualDescription}>{numerator} out of {denominator} equal parts are shaded.</div>
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

  const fractionMatch = combined.match(/(\d+)\s*\/\s*(\d+)/) || combined.match(/(\d+)\s+out of\s+(\d+)/)

  if (fractionMatch && !combined.includes('grade 10') && !combined.includes('chapter') && !combined.includes('page')) {
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

  if (combined.includes('vocabulary') || combined.includes('define') || combined.includes('definition') || combined.includes('meaning of')) {
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

  return {
    type: 'vocab',
    title: 'Vocabulary',
    word: match[1].trim(),
    definition: match[3].trim(),
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: desktopFixedHeight ? 'hidden' : 'visible',
    },
    backgroundGlowOne: {
      position: 'absolute', top: '-120px', left: '-90px', width: '320px', height: '320px', background: 'rgba(166, 82, 255, 0.24)', filter: 'blur(90px)', borderRadius: '50%', pointerEvents: 'none',
    },
    backgroundGlowTwo: {
      position: 'absolute', bottom: '-120px', right: '-70px', width: '340px', height: '340px', background: 'rgba(171, 91, 255, 0.16)', filter: 'blur(92px)', borderRadius: '50%', pointerEvents: 'none',
    },
    backgroundGlowThree: {
      position: 'absolute', top: '26%', right: '16%', width: '240px', height: '240px', background: 'rgba(214, 104, 255, 0.14)', filter: 'blur(82px)', borderRadius: '50%', pointerEvents: 'none',
    },
    backgroundGlowFour: {
      position: 'absolute', bottom: '12%', left: '8%', width: '220px', height: '220px', background: 'rgba(171, 91, 255, 0.18)', filter: 'blur(75px)', borderRadius: '50%', pointerEvents: 'none',
    },
    backgroundMesh: {
      position: 'absolute', inset: 0, background: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.25))', pointerEvents: 'none',
    },
    backgroundSweep: {
      position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 0%, transparent 36%, rgba(171, 91, 255, 0.08) 50%, transparent 64%, transparent 100%)', pointerEvents: 'none',
    },
    appFrame: {
      maxWidth: '1440px', height: desktopFixedHeight ? '100vh' : 'auto', margin: '0 auto', padding: isMobile ? '14px' : '18px', boxSizing: 'border-box', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '18px',
    },
    topNav: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexShrink: 0, flexWrap: 'wrap', padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: '22px', background: 'linear-gradient(180deg, rgba(16, 8, 34, 0.86) 0%, rgba(9, 14, 31, 0.78) 100%)', border: '1px solid rgba(191, 141, 255, 0.16)', boxShadow: '0 14px 36px rgba(0,0,0,0.24), 0 0 24px rgba(171,91,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)', backdropFilter: 'blur(14px)',
    },
    topNavLeft: { display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' },
    topNavRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    brandLink: { display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#f8f4ff' },
    brandLogoWrap: { width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' },
    brandLogoImage: { width: '30px', height: '30px', objectFit: 'contain' },
    brandTextWrap: { display: 'flex', flexDirection: 'column' },
    brandTitle: { fontSize: '18px', fontWeight: 800, letterSpacing: '0.02em' },
    brandSub: { fontSize: '12px', color: 'rgba(236,230,255,0.78)' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    navLink: { color: '#e8deff', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)' },
    navLinkCurrent: { color: '#0f0820', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '999px', background: '#ffffff', fontWeight: 700 },
    navLinkPrimary: { color: '#f7f2ff', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(156,85,255,0.32)', fontWeight: 700 },
    headerBadge: { padding: '9px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: '#f4eeff', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' },
    shell: {
      flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'minmax(380px, 470px) minmax(0, 1fr)', gap: isMobile ? '14px' : '18px', alignItems: 'stretch',
    },
    leftColumn: { minHeight: 0, display: 'flex', flexDirection: 'column', gap: '18px' },
    rightColumn: { minHeight: 0, display: 'flex', flexDirection: 'column', gap: '18px' },
    heroCard: { position: 'relative', overflow: 'hidden', borderRadius: '28px', padding: isMobile ? '20px' : '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)', border: '1px solid rgba(206,174,255,0.18)', boxShadow: '0 24px 48px rgba(0,0,0,0.22)' },
    heroSparkle: { position: 'absolute', top: '-60px', right: '-40px', width: '170px', height: '170px', borderRadius: '50%', background: 'rgba(155,89,255,0.24)', filter: 'blur(36px)' },
    heroTop: { display: 'flex', alignItems: 'center', gap: '16px' },
    logoImageWrap: { width: isMobile ? '66px' : '76px', height: isMobile ? '66px' : '76px', borderRadius: '22px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    logoImage: { width: isMobile ? '42px' : '50px', height: isMobile ? '42px' : '50px', objectFit: 'contain' },
    heroTextWrap: { display: 'flex', flexDirection: 'column', gap: '8px' },
    versionPill: { alignSelf: 'flex-start', padding: '6px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.12)' },
    heading: { margin: 0, fontSize: isMobile ? '26px' : '34px', lineHeight: 1.05 },
    tagline: { margin: 0, color: 'rgba(242,237,255,0.82)', fontSize: isMobile ? '14px' : '16px' },
    toolsCard: { minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: '28px', padding: isMobile ? '18px' : '20px', background: 'linear-gradient(180deg, rgba(15, 11, 31, 0.92) 0%, rgba(18, 14, 38, 0.86) 100%)', border: '1px solid rgba(206,174,255,0.16)', boxShadow: '0 24px 48px rgba(0,0,0,0.24)' },
    toolsHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    toolsHeaderText: { display: 'flex', flexDirection: 'column', gap: '6px' },
    sectionEyebrow: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(214,198,255,0.72)' },
    sectionTitle: { fontSize: '22px', fontWeight: 800 },
    toolsSubtext: { fontSize: '14px', color: 'rgba(226,219,255,0.76)' },
    toolTabsStickyWrap: { position: 'relative' },
    toolTabsWrap: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' },
    toolTab: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: '#f6f1ff', padding: '12px 10px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
    toolTabActive: { border: '1px solid rgba(255,255,255,0.18)', background: 'linear-gradient(135deg, rgba(156,85,255,0.92) 0%, rgba(103,209,255,0.82) 100%)', color: '#0c0918', padding: '12px 10px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
    workspacePanel: { display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '22px', padding: isMobile ? '14px' : '16px' },
    practiceHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', flexWrap: 'wrap' },
    miniLabelDarkText: { fontSize: '16px', fontWeight: 800, color: '#f7f3ff' },
    practiceHintDarkText: { fontSize: '13px', color: 'rgba(225,216,255,0.74)', marginTop: '4px' },
    sideTextarea: { width: '100%', minHeight: isMobile ? '180px' : '240px', resize: 'vertical', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.96)', color: '#180f2e', padding: '16px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    notesTextareaLarge: { width: '100%', minHeight: isMobile ? '180px' : '240px', resize: 'vertical', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.96)', color: '#180f2e', padding: '16px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    expandSketchButton: { border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: '#f8f4ff', padding: '10px 14px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
    sketchCanvasWrap: { width: '100%', minHeight: isMobile ? '220px' : '300px', height: isMobile ? '220px' : '300px', borderRadius: '20px', background: '#ffffff', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(15,15,35,0.04)' },
    sketchCanvas: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair', background: '#ffffff' },
    sketchToolbarBelow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    sketchToolButton: { border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: '#f7f3ff', padding: '10px 14px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
    sketchToolButtonActive: { border: '1px solid rgba(255,255,255,0.16)', background: '#ffffff', color: '#120a22', padding: '10px 14px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
    supportRowTwoUp: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
    supportButtonWhite: { border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f7f3ff', padding: '12px 14px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
    supportButtonWhiteStrong: { border: '1px solid rgba(255,255,255,0.12)', background: '#ffffff', color: '#120a22', padding: '12px 14px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
    reportFeatureCardCompact: { marginTop: '2px', borderRadius: '22px', padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' },
    reportFeatureTopCompact: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' },
    reportFeatureLabelCompact: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(214,198,255,0.72)' },
    reportFeatureTitleCompact: { fontSize: '16px', fontWeight: 800 },
    reportButtonCompact: { border: 'none', background: '#ffffff', color: '#120a22', padding: '10px 14px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
    reportButtonDisabledCompact: { border: 'none', background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.58)', padding: '10px 14px', borderRadius: '14px', fontWeight: 800, cursor: 'not-allowed' },
    reportFeatureTextCompact: { color: 'rgba(226,219,255,0.76)', fontSize: '14px' },
    reportPreviewInline: { padding: '12px 14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' },
    reportPreviewInlineLabel: { fontSize: '12px', color: 'rgba(214,198,255,0.72)', marginBottom: '8px' },
    reportPreviewInlineText: { fontSize: '14px', color: '#f4efff', lineHeight: 1.45 },
    toolPanelWhite: { borderRadius: '18px', background: 'rgba(255,255,255,0.96)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' },
    calcInput: { width: '100%', borderRadius: '14px', border: '1px solid rgba(22,15,44,0.12)', background: '#ffffff', color: '#180f2e', padding: '12px 14px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    calcRow: { display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', alignItems: isMobile ? 'stretch' : 'center' },
    smallButtonDark: { border: 'none', background: '#160d2b', color: '#ffffff', padding: '12px 14px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
    calcResultDark: { color: '#180f2e', fontWeight: 700 },
    chatCard: { minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '28px', padding: isMobile ? '18px' : '20px', background: 'linear-gradient(180deg, rgba(17, 12, 35, 0.92) 0%, rgba(14, 11, 29, 0.86) 100%)', border: '1px solid rgba(206,174,255,0.16)', boxShadow: '0 24px 48px rgba(0,0,0,0.24)' },
    chatHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' },
    chatEyebrow: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(214,198,255,0.72)' },
    chatTitle: { fontSize: '22px', fontWeight: 800, marginTop: '4px' },
    statusWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
    statusDot: { width: '10px', height: '10px', borderRadius: '50%', background: '#82ffb4', boxShadow: '0 0 0 6px rgba(130,255,180,0.12)' },
    statusText: { fontSize: '14px', color: '#ecdeff', fontWeight: 700 },
    quickStartInline: { marginBottom: '12px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '10px' },
    quickStartInlineLabel: { fontSize: '13px', color: 'rgba(226,219,255,0.76)', minWidth: '80px' },
    quickStartInlineButtons: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    quickStartPill: { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: '#f6f1ff', borderRadius: '999px', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
    chatCanvas: { flex: 1, minHeight: 0, borderRadius: '22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' },
    messageArea: { height: '100%', overflowY: 'auto', padding: isMobile ? '14px' : '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
    assistantBubble: { alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '14px' },
    userBubble: { alignSelf: 'flex-end', width: 'min(88%, 760px)', background: 'linear-gradient(135deg, rgba(156,85,255,0.92) 0%, rgba(110,207,255,0.86) 100%)', color: '#0f0920', borderRadius: '20px', padding: '14px' },
    bubbleLabel: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(216,203,255,0.72)', marginBottom: '8px', fontWeight: 800 },
    bubbleLabelUser: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(15,9,32,0.68)', marginBottom: '8px', fontWeight: 800 },
    bubbleText: { margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#f7f3ff' },
    userBubbleText: { margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#100a20', fontWeight: 600 },
    inputCard: { borderRadius: '28px', padding: isMobile ? '18px' : '20px', background: 'linear-gradient(180deg, rgba(17, 12, 35, 0.92) 0%, rgba(14, 11, 29, 0.86) 100%)', border: '1px solid rgba(206,174,255,0.16)', boxShadow: '0 24px 48px rgba(0,0,0,0.24)' },
    inputHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' },
    inputTitle: { fontSize: '22px', fontWeight: 800, marginTop: '4px' },
    inputHint: { fontSize: '13px', color: 'rgba(226,219,255,0.72)' },
    mainTextarea: { width: '100%', minHeight: isMobile ? '110px' : '120px', resize: 'vertical', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.97)', color: '#180f2e', padding: '16px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' },
    inputFooter: { display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginTop: '14px' },
    footerPrompt: { fontSize: '14px', color: 'rgba(226,219,255,0.76)' },
    sendButton: { border: 'none', background: '#ffffff', color: '#120a22', padding: '12px 18px', borderRadius: '14px', fontWeight: 800 },
    visualIdleCard: { position: 'relative', overflow: 'hidden', marginTop: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
    visualIdleGlow: { position: 'absolute', top: '-20px', right: '-10px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(156,85,255,0.18)', filter: 'blur(32px)' },
    visualIdleInner: { position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px' },
    visualIdleLogo: { width: '34px', height: '34px', objectFit: 'contain' },
    visualIdleTextWrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
    visualIdleTitle: { fontWeight: 800, color: '#faf7ff' },
    visualIdleText: { fontSize: '14px', color: 'rgba(226,219,255,0.76)' },
    visualCard: { marginTop: '12px', borderRadius: '18px', background: 'rgba(255,255,255,0.97)', color: '#190f2d', padding: '14px' },
    visualHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    visualTitle: { fontWeight: 800 },
    visualBadge: { fontSize: '12px', fontWeight: 800, color: '#5b21b6', background: 'rgba(124,58,237,0.10)', borderRadius: '999px', padding: '6px 10px' },
    visualDescription: { fontSize: '14px', color: '#3e2b64', lineHeight: 1.5 },
    fractionBarWrap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(24px, 1fr))', gap: '8px', marginBottom: '12px' },
    fractionPiece: { minHeight: '42px', borderRadius: '10px' },
    numberLineWrap: { position: 'relative', padding: '16px 4px 8px', marginBottom: '12px' },
    numberLineBase: { position: 'absolute', top: '28px', left: '12px', right: '12px', height: '4px', background: '#cbd5e1', borderRadius: '999px' },
    numberLineRow: { position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(28px, 1fr))', gap: '6px' },
    numberTickWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    numberDot: { width: '12px', height: '12px', borderRadius: '50%' },
    numberLabel: { fontSize: '12px' },
    vocabWord: { fontSize: '22px', fontWeight: 800, marginBottom: '8px' },
    vocabDefinition: { fontSize: '14px', lineHeight: 1.5, color: '#3e2b64' },
    vocabExampleBox: { marginTop: '12px', borderRadius: '14px', background: 'rgba(124,58,237,0.08)', padding: '12px' },
    vocabExampleLabel: { fontSize: '12px', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' },
    vocabExampleText: { fontSize: '14px', color: '#3e2b64' },
    sketchOverlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(7, 4, 18, 0.76)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '12px' : '20px' },
    sketchOverlayCard: { width: 'min(1100px, 100%)', height: isMobile ? '92vh' : '88vh', borderRadius: '28px', background: 'linear-gradient(180deg, rgba(21, 16, 43, 0.98) 0%, rgba(14, 11, 29, 0.96) 100%)', border: '1px solid rgba(206,174,255,0.18)', boxShadow: '0 30px 80px rgba(0,0,0,0.42)', display: 'flex', flexDirection: 'column', padding: isMobile ? '16px' : '20px', gap: '14px' },
    sketchOverlayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '12px', flexWrap: 'wrap' },
    overlayTitle: { fontSize: isMobile ? '24px' : '28px', fontWeight: 900 },
    overlayText: { fontSize: '14px', color: 'rgba(226,219,255,0.76)', marginTop: '6px' },
    closeOverlayButton: { border: 'none', background: '#ffffff', color: '#120a22', padding: '12px 16px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
    sketchOverlayCanvasWrap: { flex: 1, minHeight: 0, borderRadius: '24px', background: '#ffffff', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' },
    sketchOverlayCanvas: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair', background: '#ffffff' },
    sketchOverlayToolbar: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
    overlayGhostButton: { border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: '#f7f3ff', padding: '10px 14px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' },
  }
}
