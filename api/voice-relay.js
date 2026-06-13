let pending = null

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')

  if (req.method === 'POST') {
    const { transcript } = req.body
    if (!transcript) return res.status(400).json({ error: 'No transcript' })
    pending = { transcript, ts: Date.now() }
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    const result = pending
    pending = null
    return res.status(200).json({ transcript: result?.transcript ?? null })
  }

  res.status(405).end()
}
