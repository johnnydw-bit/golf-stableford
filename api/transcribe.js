import OpenAI from 'openai'
import { toFile } from 'openai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { audio, mimeType } = req.body
  if (!audio) return res.status(400).json({ error: 'No audio' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  try {
    const openai = new OpenAI({ apiKey })
    const buffer = Buffer.from(audio, 'base64')
    const ext = mimeType?.includes('webm') ? 'webm' : mimeType?.includes('mp4') ? 'mp4' : 'wav'
    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType })

    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      prompt: 'A golfer saying a single number between one and fifteen.',
    })

    res.status(200).json({ transcript: result.text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
