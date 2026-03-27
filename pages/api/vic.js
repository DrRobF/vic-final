export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body || {}

  if (!message) {
    return res.status(400).json({ error: 'Missing message' })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        prompt: {
          id: "pmpt_69c52eb12f388194824e58a741a7c6cb0becb3343e16f10b"
        },
        input: message
      })
    })

    const data = await response.json()

    const reply =
      data.output?.[0]?.content?.[0]?.text ||
      "Sorry, I had trouble responding."

    return res.status(200).json({ reply })

  } catch (error) {
    return res.status(500).json({ error: 'Server error' })
  }
}
