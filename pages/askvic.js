import { useState } from 'react'

export default function AskVIC() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')

  async function sendMessage() {
    setReply('VIC is thinking...')

    const res = await fetch('/api/vic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    const data = await res.json()
    setReply(data.reply || 'No reply')
  }

  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: 20, fontFamily: 'Arial' }}>
      <h1>Ask VIC</h1>
      <p>Type a message below.</p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        style={{ width: '100%', padding: 10, fontSize: 16 }}
        placeholder="Type here..."
      />

      <br /><br />

      <button onClick={sendMessage} style={{ padding: '10px 18px', fontSize: 16 }}>
        Send
      </button>

      <div style={{ marginTop: 30, padding: 15, background: '#f4f4f4', borderRadius: 8 }}>
        <strong>VIC:</strong>
        <p>{reply}</p>
      </div>
    </div>
  )
}
