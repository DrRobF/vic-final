import { useEffect, useRef, useState } from "react"

export default function AskVIC() {
  const [activeTool, setActiveTool] = useState("practice")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Let’s start learning 👇" },
  ])

  // --- SKETCH ---
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      const ctx = canvas.getContext("2d")
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
    }

    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  function getCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function startDraw(e) {
    const { x, y } = getCoords(e)
    const ctx = canvasRef.current.getContext("2d")
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
  }

  function draw(e) {
    if (!drawing) return
    const { x, y } = getCoords(e)
    const ctx = canvasRef.current.getContext("2d")
    ctx.lineTo(x, y)
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 3
    ctx.stroke()
  }

  function stopDraw() {
    setDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function sendSketchToVIC() {
    const canvas = canvasRef.current
    const image = canvas.toDataURL("image/png")

    sendMessage("Here is my sketch", image)
  }

  // --- CHAT ---
  async function sendMessage(text, sketchImage = null) {
    const newMessages = [...messages, { role: "user", text }]
    setMessages(newMessages)

    const res = await fetch("/api/vic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        sketchImage,
      }),
    })

    const data = await res.json()

    setMessages([
      ...newMessages,
      { role: "assistant", text: data.reply || "..." },
    ])
  }

  return (
    <div style={styles.page}>
      {/* LEFT */}
      <div style={styles.left}>
        {/* BRAND */}
        <div style={styles.hero}>
          <h2>More than answers. Real teaching.</h2>
        </div>

        {/* TOOLS */}
        <div style={styles.tools}>
          <div style={styles.toolsHeader}>Student Tools</div>

          {/* TABS */}
          <div style={styles.tabs}>
            {["practice", "sketch", "notes", "calc"].map((t) => (
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

          {/* PRACTICE */}
          {activeTool === "practice" && (
            <textarea style={styles.textarea} placeholder="Work here..." />
          )}

          {/* SKETCH */}
          {activeTool === "sketch" && (
            <div style={styles.sketchWrap}>
              <canvas
                ref={canvasRef}
                style={styles.canvas}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
              />

              {/* BUTTONS BELOW */}
              <div style={styles.row}>
                <button onClick={clearCanvas}>Clear</button>
                <button onClick={sendSketchToVIC}>
                  Discuss My Sketch
                </button>
              </div>

              <div style={styles.row}>
                <button>Hint</button>
              </div>
            </div>
          )}

          {/* NOTES */}
          {activeTool === "notes" && (
            <textarea style={styles.textarea} placeholder="Notes..." />
          )}

          {/* CALC */}
          {activeTool === "calc" && (
            <input style={styles.textarea} placeholder="Calculator..." />
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div style={styles.right}>
        <div style={styles.chat}>
          {messages.map((m, i) => (
            <div key={i} style={styles.msg}>
              <b>{m.role}:</b> {m.text}
            </div>
          ))}
        </div>

        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        <button onClick={() => sendMessage(input)}>Send</button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    display: "flex",
    height: "100vh",
    background: "#12061f",
    color: "white",
  },
  left: {
    width: "350px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  hero: {
    background: "#1c0f33",
    padding: "10px",
    borderRadius: "12px",
  },
  tools: {
    flex: 1,
    background: "#1c0f33",
    borderRadius: "12px",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflow: "auto",
  },
  toolsHeader: {
    fontWeight: "bold",
  },
  tabs: {
    display: "flex",
    gap: "5px",
  },
  tab: {
    flex: 1,
    padding: "6px",
  },
  activeTab: {
    background: "white",
    color: "black",
  },
  textarea: {
    width: "100%",
    height: "120px",
    borderRadius: "10px",
  },
  sketchWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flex: 1,
  },
  canvas: {
    width: "100%",
    height: "320px",
    background: "white",
    borderRadius: "10px",
  },
  row: {
    display: "flex",
    gap: "10px",
  },
  right: {
    flex: 1,
    padding: "10px",
    display: "flex",
    flexDirection: "column",
  },
  chat: {
    flex: 1,
    overflow: "auto",
  },
  msg: {
    marginBottom: "10px",
  },
  input: {
    height: "80px",
    marginBottom: "10px",
  },
}
