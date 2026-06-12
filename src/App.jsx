import { useState, useRef, useEffect, useCallback } from 'react'
import { holes, tees, courseHandicap, shotsOnHole, stablefordPoints, nearestGreen } from './courseData.js'

const STORAGE_KEY = 'golf_round'
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null } }
const saved = loadSaved()

const WORD_NUMS = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18,
  won:1, 'to':2, too:2, 'free':3, fore:4, 'for':4, foreign:4,
  'sex':6, sick:6, ate:8, niner:9,
}
const WORD_NUMS_SORTED = Object.entries(WORD_NUMS).sort((a, b) => b[0].length - a[0].length)

function normalise(transcript) {
  let t = transcript.toLowerCase().trim()
  for (const [word, val] of WORD_NUMS_SORTED) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), String(val))
  }
  return t
}

function parseVoice(transcript) {
  const t = normalise(transcript)
  const nums = t.match(/\d+/g)
  if (!nums || nums.length !== 1) return null
  const score = parseInt(nums[0])
  if (score < 1 || score > 15) return null
  return score
}

const CRED_KEY = 'ig_credentials'
function loadCreds() { try { return JSON.parse(localStorage.getItem(CRED_KEY)) ?? {} } catch { return {} } }

export default function App() {
  const [index, setIndex] = useState(saved?.index ?? '')
  const [tee, setTee] = useState(saved?.tee ?? 'yellow')
  const [scores, setScores] = useState(saved?.scores ?? Array(18).fill(null))
  const [finished, setFinished] = useState(null)
  const savedCreds = loadCreds()
  const [memberId, setMemberId] = useState(savedCreds.memberId ?? '')
  const [pin, setPin] = useState(savedCreds.pin ?? '')
  const [popup, setPopup] = useState(null)
  const [currentHole, setCurrentHole] = useState(0)
  const [voiceState, setVoiceState] = useState('off') // 'off' | 'listening' | 'confirm'
  const [voiceMsg, setVoiceMsg] = useState('')
  const [voiceHeard, setVoiceHeard] = useState('')
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const currentHoleRef = useRef(currentHole)
  const wakeLockRef = useRef(null)

  useEffect(() => { currentHoleRef.current = currentHole }, [currentHole])

  const persist = (i, t, s) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: i, tee: t, scores: s }))

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

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || recognitionRef.current) return

    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 5
    recognitionRef.current = rec

    rec.onstart = () => setVoiceState('listening')

    rec.onresult = (e) => {
      const results = Array.from(e.results).flatMap(r =>
        Array.from({ length: r.length }, (_, j) => r[j].transcript)
      )
      setVoiceHeard(results[0] ?? '')
      for (const transcript of results) {
        const score = parseVoice(transcript)
        if (score !== null) {
          setScore(currentHoleRef.current, score)
          setVoiceState('confirm')
          setVoiceMsg(`✓ Hole ${currentHoleRef.current + 1} — scored ${score}`)
          setVoiceHeard('')
          setTimeout(() => setVoiceState('listening'), 2000)
          return
        }
      }
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') { setVoiceState('off'); return }
      // all other errors (no-speech, network, etc) — just restart
    }

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null
        restartTimerRef.current = setTimeout(startListening, 300)
      }
    }

    try { rec.start() } catch {}
  }, [setScore])

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

  // Wake lock
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator)
          wakeLockRef.current = await navigator.wakeLock.request('screen')
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

  // Auto-start listening
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) startListening()
    return () => stopListening()
  }, [])

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const idx = nearestGreen(pos.coords.latitude, pos.coords.longitude)
        if (idx !== null) setCurrentHole(idx)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // BT clicker
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
        e.preventDefault()
        changeScore(currentHoleRef.current, +1)
      } else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault()
        setCurrentHole(h => (h + 1) % 18)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeScore])

  const [igStatus, setIgStatus] = useState('idle')
  const [igError, setIgError] = useState('')

  const handlePostToIG = async () => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    setIgStatus('posting'); setIgError('')
    try {
      localStorage.setItem(CRED_KEY, JSON.stringify({ memberId, pin }))
      const res = await fetch('/api/post-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, pin, tees: tee === 'white' ? 1 : 2, date: `${dd}-${mm}-${yy}`, hcap: playingHcp ?? 0, scores }),
      })
      const data = await res.json()
      if (data.ok) setIgStatus('ok')
      else { setIgStatus('error'); setIgError(data.error ?? 'Unknown error') }
    } catch (err) { setIgStatus('error'); setIgError(err.message) }
  }

  const handleExit = () => {
    stopListening()
    wakeLockRef.current?.release()
    setFinished({ totalPts, outPts, inPts, tee, index })
  }

  const handleNewRound = () => {
    localStorage.removeItem(STORAGE_KEY)
    setScores(Array(18).fill(null))
    setFinished(null)
    startListening()
  }

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

  if (finished) return (
    <div className="finished">
      <div className="finished-card">
        <div className="finished-title">Round Complete</div>
        <div className="finished-total">{finished.totalPts}</div>
        <div className="finished-label">Stableford Points</div>
        <div className="finished-sub">
          <span>OUT <strong>{finished.outPts}</strong></span>
          <span>IN <strong>{finished.inPts}</strong></span>
        </div>
        <div className="finished-meta">{tees[finished.tee].label} tees · Index {finished.index}</div>
        {playingHcp !== null && (
          <div className="ig-section">
            <div className="ig-creds">
              <input className="ig-input" type="text" inputMode="email"
                placeholder="Member ID or email" value={memberId} onChange={e => setMemberId(e.target.value)} />
              <input className="ig-input" type="password"
                placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
            {igStatus !== 'ok' && (
              <button className="ig-btn" onClick={handlePostToIG} disabled={igStatus === 'posting' || !memberId || !pin}>
                {igStatus === 'posting' ? 'Posting…' : 'Post to Intelligent Golf'}
              </button>
            )}
            {igStatus === 'ok' && <div className="ig-ok">Score posted to Intelligent Golf</div>}
            {igStatus === 'ok' && <div className="ig-note">Personal record only — use the IG app for an attested handicap round</div>}
            {igStatus === 'error' && <div className="ig-err">{igError}</div>}
          </div>
        )}
        <button className="start-btn" onClick={handleNewRound}>New Round</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <div className="index-field">
            <input type="number" inputMode="decimal" step="0.1" min="0" max="54"
              placeholder="Index" value={index}
              onChange={e => { setIndex(e.target.value); persist(e.target.value, tee, scores) }} />
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
          <div className="hole-picker">
            <button className="hole-pick-btn" onClick={() => setCurrentHole(h => (h + 17) % 18)}>‹</button>
            <span className="hole-pick-num">{currentHole + 1}</span>
            <button className="hole-pick-btn" onClick={() => setCurrentHole(h => (h + 1) % 18)}>›</button>
          </div>
          <button className={`mic-indicator ${voiceState}`} onClick={toggleVoice}
            title={voiceState === 'off' ? 'Tap to enable voice' : 'Tap to disable voice'}>
            <span className="mic-dot" />
          </button>
          <button className="icon-btn" onClick={resetScores} title="Reset scores">↩</button>
          <button className="exit-btn" onClick={handleExit} title="End round">Exit</button>
        </div>
      </div>

      {voiceState === 'confirm' && <div className="voice-banner confirm">{voiceMsg}</div>}
      {voiceState === 'listening' && (
        <div className="voice-banner listening">
          {voiceHeard ? `"${voiceHeard}"` : 'Listening…'}
        </div>
      )}

      <div className="grid">
        {holeData.map((h, i) => {
          const pts = h.pts
          const ptsClass = pts === null ? 'empty' : pts >= 4 ? 'p4' : pts === 3 ? 'p3' : pts === 2 ? 'p2' : pts === 1 ? 'p1' : 'p0'
          return (
            <div key={h.hole} className={`hole-row ${i === 8 ? 'after-nine' : ''} ${i === currentHole ? 'active-hole' : ''}`}>
              <button className="hole-num" onClick={() => setPopup(i)}>
                <span className="hole-num-digit">{h.hole}</span>
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

      <div className="sub-bar">
        <span>OUT <strong>{outPts}</strong></span>
        <div className="total-pts">
          <span className="total-label">Total</span>
          <span className="total-num">{totalPts}</span>
        </div>
        <span>IN <strong>{inPts}</strong></span>
      </div>

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
