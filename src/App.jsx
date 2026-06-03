import { useState, useCallback, useRef, useEffect } from 'react'
import { holes, tees, courseHandicap, shotsOnHole, stablefordPoints } from './courseData.js'

const STORAGE_KEY = 'golf_round'
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } }
const saved = loadSaved()

const WORD_NUMS = {
  // Standard words
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18,
  // Common speech-recognition mishearings
  won:1, 'to':2, too:2, 'free':3, fore:4, 'for':4, foreign:4,
  'sex':6, sick:6, ate:8, niner:9,
}

// Normalise word-numbers to digits, longest words first to avoid partial matches
const WORD_NUMS_SORTED = Object.entries(WORD_NUMS)
  .sort((a, b) => b[0].length - a[0].length)

function normalise(transcript) {
  let t = transcript.toLowerCase().trim()
  for (const [word, val] of WORD_NUMS_SORTED) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), String(val))
  }
  return t
}

// Parse "I scored [score] on [hole]" or "I scored [score] on hole [hole]"
function parseVoice(transcript) {
  const t = normalise(transcript)
  const m = t.match(/scor\w*\s+(\d+)\s+on\s+(?:(?:hole|whole|hold)\s+)?(\d+)/)
  if (!m) return null
  const score = parseInt(m[1])
  const hole  = parseInt(m[2])
  if (hole < 1 || hole > 18 || score < 1 || score > 15) return null
  return { score, hole }
}

export default function App() {
  const [index, setIndex] = useState(saved?.index ?? '')
  const [tee, setTee] = useState(saved?.tee ?? 'yellow')
  const [scores, setScores] = useState(saved?.scores ?? Array(18).fill(null))
  const [popup, setPopup] = useState(null)
  const [voiceState, setVoiceState] = useState('off') // 'off' | 'listening' | 'confirm' | 'error'
  const [voiceMsg, setVoiceMsg] = useState('')
  const [voiceHeard, setVoiceHeard] = useState('')
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const scoresRef = useRef(scores)
  const indexRef = useRef(index)
  const teeRef = useRef(tee)

  const persist = (i, t, s) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: i, tee: t, scores: s }))

  // Keep refs in sync so recognition callbacks always see latest state
  useEffect(() => { scoresRef.current = scores }, [scores])
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { teeRef.current = tee }, [tee])

  const playingHcp = index !== '' && !isNaN(Number(index))
    ? courseHandicap(Number(index), tee) : null

  const changeScore = useCallback((i, delta) => {
    setScores(prev => {
      const next = [...prev]
      const cur = next[i]
      const par = holes[i].par
      next[i] = cur === null ? par : Math.min(Math.max(cur + delta, 1), 15)
      persist(index, tee, next)
      return next
    })
  }, [index, tee])

  const setScore = useCallback((i, val) => {
    setScores(prev => {
      const next = [...prev]
      next[i] = Math.min(Math.max(val, 1), 15)
      persist(index, tee, next)
      return next
    })
  }, [index, tee])

  const resetScores = () => {
    const fresh = Array(18).fill(null)
    setScores(fresh)
    persist(index, tee, fresh)
  }

  // Always-on continuous recognition — triggers on "I scored X on hole Y"
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
    }

    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 3
    recognitionRef.current = rec

    rec.onstart = () => setVoiceState('listening')

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const best = e.results[i][0].transcript
        // Show live transcript so user can see mic is working
        setVoiceHeard(best)

        // Try all alternatives for a score match
        for (let j = 0; j < e.results[i].length; j++) {
          const parsed = parseVoice(e.results[i][j].transcript)
          if (parsed) {
            setScore(parsed.hole - 1, parsed.score)
            setVoiceState('confirm')
            setVoiceMsg(`✓ Hole ${parsed.hole} — scored ${parsed.score}`)
            setVoiceHeard('')
            setTimeout(() => { setVoiceState('listening'); setVoiceHeard('') }, 2000)
            return
          }
        }
      }
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return // silent timeout, just restart
      if (e.error === 'not-allowed') {
        setVoiceState('off')
        setVoiceMsg('Mic permission denied')
        return
      }
    }

    // Auto-restart when it stops (browsers cut off after ~60s silence)
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        restartTimerRef.current = setTimeout(startListening, 300)
      }
    }

    try { rec.start() } catch {}
  }, [])

  const stopListening = () => {
    clearTimeout(restartTimerRef.current)
    const rec = recognitionRef.current
    recognitionRef.current = null
    try { rec?.abort() } catch {}
    setVoiceState('off')
    setVoiceMsg('')
    setVoiceHeard('')
  }

  const toggleVoice = () => {
    if (voiceState === 'off') startListening()
    else stopListening()
  }

  // Wake lock — keep screen on while app is open
  const wakeLockRef = useRef(null)
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }
    acquire()
    const reacquire = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', reacquire)
    return () => {
      document.removeEventListener('visibilitychange', reacquire)
      wakeLockRef.current?.release()
    }
  }, [])

  // Exit — stop mic, release wake lock, clear session
  const handleExit = () => {
    stopListening()
    wakeLockRef.current?.release()
    localStorage.removeItem(STORAGE_KEY)
    setScores(Array(18).fill(null))
    setIndex('')
    setTee('yellow')
  }

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) startListening()
    return () => stopListening()
  }, [])

  const holeData = holes.map((h, i) => {
    const shots = playingHcp !== null ? shotsOnHole(playingHcp, h.si) : 0
    const pts = stablefordPoints(scores[i], h.par, shots)
    return { ...h, shots, pts }
  })

  const sumPts = arr => arr.reduce((acc, h) => acc + (h.pts ?? 0), 0)
  const totalPts = sumPts(holeData)
  const outPts   = sumPts(holeData.slice(0, 9))
  const inPts    = sumPts(holeData.slice(9))

  const popupHole = popup !== null ? holeData[popup] : null

  return (
    <div className="app">
      {/* ── Header ── */}
      <div className="header">
        <div className="header-left">
          <div className="index-field">
            <label>Index</label>
            <input
              type="number" inputMode="decimal" step="0.1" min="0" max="54"
              placeholder="0.0" value={index}
              onChange={e => { setIndex(e.target.value); persist(e.target.value, tee, scores) }}
            />
          </div>
          <div className="tee-toggle">
            {['white','yellow'].map(t => (
              <button key={t} className={`tee-btn ${t} ${tee===t?'active':''}`}
                onClick={() => { setTee(t); persist(index, t, scores) }}>
                {tees[t].label}
              </button>
            ))}
          </div>
          {playingHcp !== null && <span className="hcp-pill">CH {playingHcp}</span>}
        </div>
        <div className="header-right">
          <div className="total-box">
            <span className="total-label">PTS</span>
            <span className="total-val">{totalPts}</span>
          </div>
          <button
            className={`mic-indicator ${voiceState}`}
            onClick={toggleVoice}
            title={voiceState === 'off' ? 'Tap to enable voice' : 'Tap to disable voice'}
          >
            <span className="mic-dot" />
          </button>
          <button className="icon-btn reset-btn" onClick={resetScores} title="Reset scores">↩</button>
          <button className="exit-btn" onClick={handleExit} title="End round">Exit</button>
        </div>
      </div>

      {/* ── Voice status banner ── */}
      {voiceState === 'confirm' && (
        <div className="voice-banner confirm">{voiceMsg}</div>
      )}
      {voiceState === 'listening' && (
        <div className="voice-banner listening">
          {voiceHeard ? `"${voiceHeard}"` : '🎤 Say "I scored 4 on hole 7"'}
        </div>
      )}

      {/* ── Scorecard grid ── */}
      <div className="grid">
        {holeData.map((h, i) => {
          const pts = h.pts
          const ptsClass = pts === null ? 'empty' : pts >= 4 ? 'p4' : pts === 3 ? 'p3' : pts === 2 ? 'p2' : pts === 1 ? 'p1' : 'p0'
          return (
            <div key={h.hole} className={`hole-row ${i === 8 ? 'after-nine' : ''}`}>
              <button className="hole-num" onClick={() => setPopup(i)}>
                {h.hole}
                {h.shots > 0 && <span className="dot-row">{Array.from({length:h.shots}).map((_,k)=><span key={k} className="dot"/>)}</span>}
              </button>
              <div className="stepper">
                <button className="step-btn" onPointerDown={() => changeScore(i, -1)}>−</button>
                <span className={`score-val ${scores[i]===null?'dash':''}`}>
                  {scores[i] === null ? '—' : scores[i]}
                </span>
                <button className="step-btn" onPointerDown={() => changeScore(i, +1)}>+</button>
              </div>
              <div className={`chip ${ptsClass}`}>{pts === null ? '·' : pts}</div>
            </div>
          )
        })}
      </div>

      {/* ── Subtotals bar ── */}
      <div className="sub-bar">
        <span>OUT <strong>{outPts}</strong></span>
        <span className="total-pts">TOTAL <strong>{totalPts}</strong></span>
        <span>IN <strong>{inPts}</strong></span>
      </div>

      {/* ── Hole detail popup ── */}
      {popupHole && (
        <div className="overlay" onClick={() => setPopup(null)}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <div className="popup-title">Hole {popupHole.hole}</div>
            <div className="popup-grid">
              <span>Par</span><strong>{popupHole.par}</strong>
              <span>Stroke Index</span><strong>{popupHole.si}</strong>
              <span>{tees[tee].label} yards</span><strong>{tee==='white'?popupHole.white:popupHole.yellow}y</strong>
              <span>Shots received</span><strong>{popupHole.shots}</strong>
            </div>
            <button className="popup-close" onClick={() => setPopup(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
