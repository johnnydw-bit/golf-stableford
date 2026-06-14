import { useState, useRef, useEffect, useCallback } from 'react'
import { holes, tees, courseHandicap, shotsOnHole, stablefordPoints, nearestGreen } from './courseData.js'
import { resolveNames } from './nameAliases.js'

const WORD_NUMS = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18,
  won:1, 'to':2, too:2, who:2, 'free':3, fore:4, 'for':4, foreign:4,
  'sex':6, sick:6, ate:8, niner:9,
}
const WORD_NUMS_SORTED = Object.entries(WORD_NUMS).sort((a, b) => b[0].length - a[0].length)

function normalise(t) {
  t = t.toLowerCase().trim()
  for (const [word, val] of WORD_NUMS_SORTED)
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), String(val))
  return t
}

function parseScore(transcript) {
  const t = normalise(transcript.replace(/\bstrokes?\b/gi, '') + ' strokes')
  const nums = (t.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 15)
  return nums.length ? nums[nums.length - 1] : null
}

// "one played four" → player 0, score 4
// "four strokes" alone → player 0, score 4 (fallback)
function parseVoice(transcript) {
  const t = normalise(transcript)
  // Look for "[player] played [score]" pattern
  const playedMatch = t.match(/\b([1-4])\s+played\s+(\d+)\b/)
  if (playedMatch) {
    const playerIdx = parseInt(playedMatch[1]) - 1
    const score = parseInt(playedMatch[2])
    if (score >= 1 && score <= 15) return { playerIdx, score }
  }
  // Fallback: just a score number → player 0
  const score = parseScore(transcript)
  return score !== null ? { playerIdx: 0, score } : null
}

const SETUP_KEY  = 'golf_setup_4p'
const SCORES_KEY = 'golf_scores_4p'
const CRED_KEY   = 'ig_credentials'

const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))

const EMPTY_SCORES = () => Array(18).fill(null).map(() => Array(4).fill(null))
const DEFAULT_SETUP = () => ({
  matchType: 'individual',
  tee: 'yellow',
  players: Array(4).fill(null).map(() => ({ name: '', index: '' })),
})

export default function App() {
  const [phase, setPhase]   = useState(() => load(SETUP_KEY) ? 'scoring' : 'setup')
  const [setup, setSetup]   = useState(() => load(SETUP_KEY) ?? DEFAULT_SETUP())
  const [scores, setScores] = useState(() => load(SCORES_KEY) ?? EMPTY_SCORES())
  const [currentHole, setCurrentHole] = useState(0)
  const [voiceMsg, setVoiceMsg]   = useState('')
  const [voiceHeard, setVoiceHeard] = useState('')

  const currentHoleRef   = useRef(0)
  const wakeLockRef      = useRef(null)
  const lastScoreRef     = useRef(null)
  const lastScoreTimeRef = useRef(0)
  const setupRef         = useRef(setup)
  const pollRef          = useRef(null)

  useEffect(() => { currentHoleRef.current = currentHole }, [currentHole])
  useEffect(() => { setupRef.current = setup }, [setup])

  // Computed handicaps
  const playingHcps = setup.players.map(p => {
    const idx = Number(p.index)
    return p.index !== '' && !isNaN(idx) ? courseHandicap(idx, setup.tee) : null
  })
  const activeHcps = setup.matchType === '4bb'
    ? playingHcps.map(h => h !== null ? Math.round(h * 0.75) : null)
    : playingHcps

  const changeScore = useCallback((hole, pi, delta) => {
    setScores(prev => {
      const next = prev.map(r => [...r])
      const cur = next[hole][pi]
      next[hole][pi] = cur === null ? holes[hole].par : Math.min(Math.max(cur + delta, 1), 15)
      save(SCORES_KEY, next)
      return next
    })
  }, [])

  const setPlayerScore = useCallback((hole, pi, val) => {
    setScores(prev => {
      const next = prev.map(r => [...r])
      next[hole][pi] = Math.min(Math.max(val, 1), 15)
      save(SCORES_KEY, next)
      return next
    })
  }, [])

  const applyTranscript = useCallback((transcript) => {
    setVoiceHeard('')
    setTimeout(() => setVoiceHeard(transcript), 50)
    const cleaned = resolveNames(transcript)
      .replace(/\b(plate|blade|played|blayed|plade)\b/gi, 'played')
    const t = normalise(cleaned)
    const players = setupRef.current.players
    const confirmed = []
    setVoiceHeard(`PARSED: ${t}`)

    players.forEach((p, pi) => {
      const rawName = p.name.trim().toLowerCase()
      if (!rawName) return
      const name = resolveNames(rawName).trim()
      const re = new RegExp(`\\b${name}\\s+(?:played\\s+)?(\\d+)\\b`, 'i')
      const m = t.match(re)
      if (m) {
        const score = parseInt(m[1])
        if (score >= 1 && score <= 15) {
          setPlayerScore(currentHoleRef.current, pi, score)
          confirmed.push(`${p.name} ${score}`)
        }
      }
    })

    if (confirmed.length) {
      setVoiceMsg(`✓ ${confirmed.join(' · ')}`)
    } else {
      setVoiceMsg('? not recognised')
    }
    setVoiceHeard(cleaned)
  }, [setPlayerScore])

  // Wake lock
  useEffect(() => {
    const acquire = async () => {
      try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
    }
    acquire()
    const reacquire = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', reacquire)
    return () => { document.removeEventListener('visibilitychange', reacquire); wakeLockRef.current?.release() }
  }, [])

  // Simulate Tasker: one-shot listen then POST to relay
  const simulateTasker = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.onresult = async (e) => {
      const transcript = e.results[0][0].transcript
      await fetch('/api/voice-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
    }
    rec.start()
  }, [])

  // GPS — hole switching only, no mic control
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        const nearIdx = nearestGreen(latitude, longitude, 30)
        if (nearIdx !== null) setCurrentHole(nearIdx)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Poll relay endpoint every second
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/voice-relay')
        const data = await res.json()
        if (data.transcript) applyTranscript(data.transcript)
      } catch {}
    }, 1000)
    return () => clearInterval(pollRef.current)
  }, [applyTranscript])

  // BT clicker — next hole only (Tasker handles scoring)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault(); setCurrentHole(h => (h + 1) % 18)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Per-hole data
  const holeData = holes.map((h, hi) => {
    const playerPts = setup.players.map((_, pi) => {
      const shots = activeHcps[pi] !== null ? shotsOnHole(activeHcps[pi], h.si) : 0
      return stablefordPoints(scores[hi][pi], h.par, shots)
    })
    const pairPts = setup.matchType === '4bb' ? [
      Math.max(playerPts[0] ?? 0, playerPts[1] ?? 0),
      Math.max(playerPts[2] ?? 0, playerPts[3] ?? 0),
    ] : null
    return { ...h, playerPts, pairPts }
  })

  const sumRange = (from, to, pi) =>
    holeData.slice(from, to).reduce((s, h) => s + (h.playerPts[pi] ?? 0), 0)

  const outPts   = setup.players.map((_, pi) => sumRange(0, 9, pi))
  const inPts    = setup.players.map((_, pi) => sumRange(9, 18, pi))
  const totalPts = setup.players.map((_, pi) => sumRange(0, 18, pi))

  const pairTotals = setup.matchType === '4bb' ? [
    holeData.reduce((s, h) => s + (h.pairPts?.[0] ?? 0), 0),
    holeData.reduce((s, h) => s + (h.pairPts?.[1] ?? 0), 0),
  ] : null

  // ── Setup page ──────────────────────────────────────────────────
  if (phase === 'setup') {
    const updatePlayer = (i, field, val) =>
      setSetup(prev => ({ ...prev, players: prev.players.map((p, j) => j === i ? { ...p, [field]: val } : p) }))

    const canStart = setup.players.some(p => p.name.trim())

    return (
      <div className="setup-page">
        <div className="setup-title">Bramley Golf Club</div>

        <div className="setup-row">
          <label>Match</label>
          <div className="tog">
            {[['individual','Individual'],['4bb','4BB']].map(([val, label]) => (
              <button key={val} className={setup.matchType === val ? 'tog-on' : ''}
                onClick={() => setSetup(p => ({ ...p, matchType: val }))}>{label}</button>
            ))}
          </div>
        </div>

        <div className="setup-row">
          <label>Tee</label>
          <div className="tog">
            {['white','yellow'].map(t => (
              <button key={t} className={setup.tee === t ? 'tog-on' : ''}
                onClick={() => setSetup(p => ({ ...p, tee: t }))}>{tees[t].label}</button>
            ))}
          </div>
        </div>

        <table className="setup-table">
          <thead>
            <tr><th>#</th><th>Name</th><th>Index</th><th>{setup.matchType === '4bb' ? 'CH (4BB)' : 'CH'}</th></tr>
          </thead>
          <tbody>
            {setup.players.map((p, i) => {
              const idx = Number(p.index)
              const hcp = p.index !== '' && !isNaN(idx) ? courseHandicap(idx, setup.tee) : null
              const bbHcp = hcp !== null && setup.matchType === '4bb' ? Math.round(hcp * 0.75) : null
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><input value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)} placeholder={`Player ${i + 1}`} /></td>
                  <td><input type="number" value={p.index} onChange={e => updatePlayer(i, 'index', e.target.value)} placeholder="0.0" step="0.1" min="0" max="54" /></td>
                  <td>{bbHcp !== null ? `${hcp} (${bbHcp})` : hcp ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <button className="start-btn" onClick={() => {
          save(SETUP_KEY, setup)
          const fresh = EMPTY_SCORES()
          setScores(fresh); save(SCORES_KEY, fresh)
          setPhase('scoring')
        }} disabled={!canStart}>Start Round</button>
      </div>
    )
  }

  // ── Finished page ────────────────────────────────────────────────
  if (phase === 'finished') {
    return (
      <div className="setup-page">
        <div className="setup-title">Round Complete</div>
        <table className="setup-table">
          <thead>
            <tr><th>Player</th><th>CH</th><th>Out</th><th>In</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {setup.players.map((p, i) => (
              <tr key={i}>
                <td>{p.name || `P${i + 1}`}</td>
                <td>{activeHcps[i] ?? '—'}</td>
                <td>{outPts[i]}</td>
                <td>{inPts[i]}</td>
                <td><strong>{totalPts[i]}</strong></td>
              </tr>
            ))}
            {setup.matchType === '4bb' && pairTotals && <>
              <tr className="sc-pair-row"><td colSpan={4}>Pair A (P1+P2)</td><td><strong>{pairTotals[0]}</strong></td></tr>
              <tr className="sc-pair-row"><td colSpan={4}>Pair B (P3+P4)</td><td><strong>{pairTotals[1]}</strong></td></tr>
            </>}
          </tbody>
        </table>
        <button className="start-btn" onClick={() => {
          localStorage.removeItem(SCORES_KEY); localStorage.removeItem(SETUP_KEY)
          setScores(EMPTY_SCORES()); setSetup(DEFAULT_SETUP()); setPhase('setup')
        }}>New Round</button>
      </div>
    )
  }

  // ── Scoring page ─────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="sc-hdr">
        <div className="hole-picker">
          <button onPointerDown={() => setCurrentHole(h => (h + 17) % 18)}>‹</button>
          <span>{currentHole + 1}</span>
          <button onPointerDown={() => setCurrentHole(h => (h + 1) % 18)}>›</button>
        </div>
        <span className="relay-dot" title="Tasker relay active" />
        <button className="sc-setup" onClick={simulateTasker}>Test</button>
        <button className="sc-done" onClick={() => { setPhase('finished') }}>Done</button>
        <button className="sc-back" onClick={() => { localStorage.removeItem(SETUP_KEY); setSetup(DEFAULT_SETUP()); setPhase('setup') }}>Setup</button>
        <span className="version-tag">v1.50</span>
      </div>

      {voiceMsg && <div className={`voice-banner ${voiceMsg.startsWith('✓') ? 'confirm' : 'listening'}`}>{voiceMsg}</div>}
      {voiceHeard && <div className="voice-banner debug">RAW: "{voiceHeard}"</div>}

      <div className="sc-scroll">
        <table className="sc-table">
          <thead>
            <tr>
              <th className="sc-th-h">H</th>
              <th className="sc-th-p">P</th>
              <th className="sc-th-s">SI</th>
              {setup.players.map((p, i) => (
                <th key={i} className="sc-th-pl">
                  {p.name || `P${i + 1}`}
                  {activeHcps[i] !== null && <span className="sc-hcp-sub"> {activeHcps[i]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holeData.map((h, hi) => (
              <tr key={hi} className={`${hi === currentHole ? 'sc-active' : ''} ${hi === 8 ? 'sc-after9' : ''}`}>
                <td className="sc-hole">{h.hole}</td>
                <td className="sc-par">{h.par}</td>
                <td className="sc-si">{h.si}</td>
                {setup.players.map((_, pi) => {
                  const sc = scores[hi][pi]
                  const pts = h.playerPts[pi]
                  const pc = pts === null ? 'pe' : pts >= 4 ? 'p4' : pts === 3 ? 'p3' : pts === 2 ? 'p2' : pts === 1 ? 'p1' : 'p0'
                  return (
                    <td key={pi} className="sc-cell">
                      <div className="sc-stepper">
                        <button onPointerDown={() => changeScore(hi, pi, -1)}>−</button>
                        <span className={sc === null ? 'sc-dash' : 'sc-num'}>{sc ?? '—'}</span>
                        <button onPointerDown={() => changeScore(hi, pi, +1)}>+</button>
                      </div>
                      <div className={`sc-pts ${pc}`}>{pts === null ? '·' : pts}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="sc-sub">
              <td colSpan={3}>Out</td>
              {outPts.map((t, i) => <td key={i}>{t}</td>)}
            </tr>
            <tr className="sc-sub">
              <td colSpan={3}>In</td>
              {inPts.map((t, i) => <td key={i}>{t}</td>)}
            </tr>
            <tr className="sc-total">
              <td colSpan={3}>Pts</td>
              {totalPts.map((t, i) => <td key={i}>{t}</td>)}
            </tr>
            {setup.matchType === '4bb' && pairTotals && (
              <tr className="sc-total sc-pair-row">
                <td colSpan={3}>4BB</td>
                <td colSpan={2}>{pairTotals[0]}</td>
                <td colSpan={2}>{pairTotals[1]}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
