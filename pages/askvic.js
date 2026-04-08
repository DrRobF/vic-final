import { useEffect, useMemo, useRef, useState } from 'react'

const BRAIN_VERSION = 'v3.3'

export default function AskVIC() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workArea, setWorkArea] = useState('')
  const [notes, setNotes] = useState('')
  const [activeTool, setActiveTool] = useState('practice')
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Let’s start learning 👇' },
  ])

  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)

  // --- FIX CANVAS SIZE ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // --- DRAWING ---
  function startDraw(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')

    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)

    ctx.lineWidth = isErasingRef.current ? 18 : 3
    ctx.strokeStyle = isErasingRef.current ? '#ffffff' : '#000000'

    isDrawingRef.current = true
  }

  function draw(e) {
    if (!isDrawingRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  function stopDraw() {
    isDrawingRef.current = false
  }

  function setMode(mode) {
    isErasingRef.current = mode === 'erase'
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function discussSketch() {
    const image = canvasRef.current.toDataURL('image/png')

    await sendMessage({
      text: 'Look at my sketch and respond like a calm teacher.',
      sketchImage: image,
    })
  }

  async function sendMessage(customMessage) {
    const text =
      typeof customMessage === 'string'
        ? customMessage
        : customMessage.text

    const sketchImage =
      typeof customMessage === 'object'
        ? customMessage.sketchImage
        : null

    const newMessages = [...messages, { role: 'user', text }]
    setMessages(newMessages)
    setLoading(true)

    const res = await fetch('/api/vic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, sketchImage }),
    })

    const data = await res.json()

    setMessages([
      ...newMessages,
      { role: 'assistant', text: data.reply },
    ])

    setLoading(false)
  }

  function runCalculator() {
    try {
      const result = eval(calcInput)
      setCalcResult(result)
    } catch {
      setCalcResult('Error')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <h2>More than answers. Real teaching.</h2>

        <div style={styles.tools}>
          <h3>Student Tools</h3>

          <div style={styles.tabs}>
            {['practice', 'sketch', 'notes', 'calc'].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTool(t)}
                style={{
                  ...styles.tab,
                  ...(activeTool === t ? styles.activeTab : {}),
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {activeTool === 'practice' && (
            <textarea
              value={workArea}
              onChange={(e) => setWorkArea(e.target.value)}
              style={styles.textarea}
              placeholder="Work here..."
            />
          )}

          {activeTool === 'sketch' && (
            <div style={styles.sketchWrap}>
              <canvas
                ref={canvasRef}
                style={styles.canvas}
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
              />

              {/* BUTTONS BELOW */}
              <div style={styles.row}>
                <button onClick={() => setMode('draw')}>Pen</button>
                <button onClick={() => setMode('erase')}>Erase</button>
                <button onClick={clearCanvas}>Clear</button>
                <button onClick={discussSketch}>
                  Discuss My Sketch
                </button>
              </div>
            </div>
          )}

          {activeTool === 'notes' && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.textarea}
              placeholder="Notes..."
            />
          )}

          {activeTool === 'calc' && (
            <>
              <input
                value={calcInput}
                onChange={(e) => setCalcInput(e.target.value)}
              />
              <button onClick={runCalculator}>Calculate</button>
              <div>{calcResult}</div>
            </>
          )}
        </div>
      </div>

      <div style={styles.right}>
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.role}:</b> {m.text}
          </div>
        ))}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button onClick={() => sendMessage(input)}>Send</button>
      </div>
    </div>
  )
}

const styles = {
  page: { display: 'flex', height: '100vh' },
  left: { width: '350px', padding: '10px' },
  right: { flex: 1, padding: '10px' },
  tools: { display: 'flex', flexDirection: 'column', gap: '10px' },
  tabs: { display: 'flex', gap: '5px' },
  tab: { flex: 1 },
  activeTab: { background: 'black', color: 'white' },
  textarea: { width: '100%', height: '120px' },
  sketchWrap: { display: 'flex', flexDirection: 'column', gap: '10px' },
  canvas: {
    width: '100%',
    height: '340px',
    background: 'white',
  },
  row: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
}
