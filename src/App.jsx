import { useState, useRef, useEffect, useCallback } from 'react'
import { holes, tees, courseHandicap, shotsOnHole, stablefordPoints, nearestGreen } from './courseData.js'

const WORD_NUMS = {
  one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
  ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18,
  won:1, 'to':2, too:2, 'free':3, fore:4, 'for':4, foreign:4,
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

// "one four strokes" → player 0, score 4
// "four strokes" → player 0, score 4 (fallback)
function parseVoice(transcript) {
  const t = normalise(transcript.replace(/\bstrokes?\b/gi, '').replace(/\bshots?\b/gi, '').trim())
  const nums = (t.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 18)
  if (!nums.length) return null
  if (nums.length >= 2 && nums[0] >= 1 && nums[0] <= 4) {
    const score = nums.slice(1).find(n => n >= 1 && n <= 15)
    if (score !== undefined) return { playerIdx: nums[0] - 1, score }
  }
  const score = nums.find(n => n >= 1 && n <= 15)
  return score !== undefined ? { playerIdx: 0, score } : null
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
  const [voiceState, setVoiceState]   = useState('off')
  const [voiceMsg, setVoiceMsg]       = useState('')
  const [voiceHeard, setVoiceHeard]   = useState('')

  const recognitionRef    = useRef(null)
  const restartTimerRef   = useRef(null)
  const currentHoleRef    = useRef(0)
  const wakeLockRef       = useRef(null)
  const manualMicRef      = useRef(false)
  const lastScoreRef      = useRef(null)
  const lastScoreTimeRef  = useRef(0)
  const setupRef          = useRef(setup)

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

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR || recognitionRef.current) return
    const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 5
    if (SGL) {
      const grammar = '#JSGF V1.0; grammar score; public <score> = ' +
        'one two | one three | one four | one five | one six | one seven | one eight | one nine | one ten | ' +
        'two two | two three | two four | two five | two six | two seven | two eight | two nine | two ten | ' +
        'three two | three three | three four | three five | three six | three seven | three eight | three nine | three ten | ' +
        'four two | four three | four four | four five | four six | four seven | four eight | four nine | four ten | ' +
        'one | two | three | four | five | six | seven | eight | nine | ten | ' +
        'eleven | twelve | thirteen | fourteen | fifteen | ' +
        'stroke | strokes | shots ;'
      const list = new SGL(); list.addFromString(grammar, 1); rec.grammars = list
    }
    recognitionRef.current = rec
    rec.onstart = () => setVoiceState('listening')
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        setVoiceHeard(result[0].transcript)
        const alts = Array.from({ length: result.length }, (_, j) => result[j].transcript)
        for (const transcript of alts) {
          const parsed = parseVoice(transcript)
          if (parsed) {
            const { playerIdx, score } = parsed
            const key = `${playerIdx}-${score}`
            const now = Date.now()
            if (key === lastScoreRef.current && now - lastScoreTimeRef.current < 2000) return
            lastScoreRef.current = key
            lastScoreTimeRef.current = now
            setPlayerScore(currentHoleRef.current, playerIdx, score)
            const name = setupRef.current.players[playerIdx].name || `P${playerIdx + 1}`
            setVoiceState('confirm')
            setVoiceMsg(`✓ ${name} — hole ${currentHoleRef.current + 1} scored ${score}`)
            setVoiceHeard('')
            setTimeout(() => { setVoiceState('listening'); setVoiceHeard('') }, 2000)
            return
          }
        }
      }
    }
    rec.onerror = (e) => { if (e.error === 'not-allowed') setVoiceState('off') }
    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null
        restartTimerRef.current = setTimeout(startListening, 100)
      }
    }
    try { rec.start() } catch {}
  }, [setPlayerScore])

  const stopListening = useCallback(() => {
    clearTimeout(restartTimerRef.current)
    const rec = recognitionRef.current
    recognitionRef.current = null
    try { rec?.abort() } catch {}
    setVoiceState('off'); setVoiceMsg(''); setVoiceHeard('')
  }, [])

  const toggleVoice = () => {
    if (voiceState === 'off') { manualMicRef.current = true; startListening() }
    else { manualMicRef.current = false; stopListening() }
  }

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

  useEffect(() => () => stopListening(), [stopListening])

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        const nearIdx = nearestGreen(latitude, longitude, 30)
        if (nearIdx !== null) setCurrentHole(nearIdx)
        if (!manualMicRef.current) { if (nearIdx !== null) startListening(); else stopListening() }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [startListening, stopListening])

  // BT clicker — volume up: +1 for player 0, volume down: next hole
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'AudioVolumeUp' || e.key === 'VolumeUp') {
        e.preventDefault(); changeScore(currentHoleRef.current, 0, +1)
      } else if (e.key === 'AudioVolumeDown' || e.key === 'VolumeDown') {
        e.preventDefault(); setCurrentHole(h => (h + 1) % 18)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeScore])

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
        <button className={`mic-indicator ${voiceState}`} onClick={toggleVoice} title="Toggle voice">
          <span className="mic-dot" />
        </button>
        <button className="sc-done" onClick={() => { stopListening(); setPhase('finished') }}>Done</button>
        <button className="sc-setup" onClick={() => { stopListening(); setPhase('setup') }}>Setup</button>
        <span className="version-tag">v1.26</span>
      </div>

      {voiceState === 'confirm'   && <div className="voice-banner confirm">{voiceMsg}</div>}
      {voiceState === 'listening' && (
        <div className="voice-banner listening">
          {voiceHeard ? `"${voiceHeard}"` : 'Say: [1-4] N strokes'}
        </div>
      )}

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
