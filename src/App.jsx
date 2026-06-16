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
const GPS_LOG_KEY = 'golf_gps_log'
const CRED_KEY   = 'ig_credentials'

const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false })

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
  const [voiceMsg, setVoiceMsg]     = useState('')
  const [voiceHeard, setVoiceHeard] = useState('')
  const [gpsLog, setGpsLog]         = useState(() => load(GPS_LOG_KEY) ?? [])
  const [showLog, setShowLog]       = useState(false)

  const currentHoleRef      = useRef(0)
  const wakeLockRef         = useRef(null)
  const lastScoreRef        = useRef(null)
  const lastScoreTimeRef    = useRef(0)
  const setupRef            = useRef(setup)
  const scoresRef           = useRef(scores)
  const applyTranscriptRef  = useRef(null)
  const startListeningRef   = useRef(null)

  useEffect(() => { currentHoleRef.current = currentHole }, [currentHole])
  useEffect(() => { setupRef.current = setup }, [setup])
  useEffect(() => { scoresRef.current = scores }, [scores])

  const addLog = useCallback((event, data = {}) => {
    const entry = { ts: ts(), event, ...data }
    setGpsLog(prev => {
      const next = [...prev, entry]
      save(GPS_LOG_KEY, next)
      return next
    })
  }, [])

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
    setVoiceHeard(transcript)
    const cleaned = resolveNames(transcript)
      .replace(/\b(plate|blade|played|blayed|plade)\b/gi, 'played')
    const t = normalise(cleaned)
    const players = setupRef.current.players
    const confirmed = []

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

    const result = confirmed.length ? `✓ ${confirmed.join(' · ')}` : '? not recognised'
    setVoiceMsg(result)
    addLog('STT', { hole: currentHoleRef.current, transcript, scores: confirmed.join(' · ') || 'none' })
  }, [setPlayerScore, addLog])

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

  const startListening = useCallback((holeIdx) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    navigator.vibrate?.(500)
    setVoiceMsg('🎤 …')
    const utterance = new SpeechSynthesisUtterance('Enter scores')
    utterance.lang = 'en-GB'
    utterance.rate = 1.2
    utterance.onend = () => setTimeout(() => {
      const rec = new SR()
      rec.lang = 'en-GB'
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 3
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript
        applyTranscriptRef.current?.(transcript)
      }
      rec.onerror = (err) => addLog('STT_ERR', { hole: holeIdx ?? currentHoleRef.current, error: err.error })
      rec.start()
      addLog('STT_START', { hole: holeIdx ?? currentHoleRef.current })
      setVoiceMsg('🎤 listening…')
    }, 300)
    speechSynthesis.speak(utterance)
  }, [addLog])

  useEffect(() => { applyTranscriptRef.current = applyTranscript }, [applyTranscript])
  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  // GPS — sequential hole advance only, STT on exit if dwell≥20s and hole unscored
  useEffect(() => {
    if (!navigator.geolocation) return
    let lastNearIdx = null
    let approachTime = null
    const MIN_DWELL_MS = 20000
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const nearIdx = nearestGreen(lat, lng, 30)
        if (nearIdx !== null && nearIdx !== lastNearIdx) {
          const cur = currentHoleRef.current
          // Only advance to the next sequential hole, never back or skip
          if (nearIdx === cur || nearIdx === cur + 1) {
            if (nearIdx === cur + 1) setCurrentHole(nearIdx)
            addLog('APPROACH', { hole: nearIdx, lat: +lat.toFixed(5), lng: +lng.toFixed(5) })
            lastNearIdx = nearIdx
            approachTime = Date.now()
          } else {
            addLog('APPROACH_SKIP', { hole: nearIdx, cur, reason: nearIdx < cur ? 'back' : 'skip' })
          }
        } else if (nearIdx === null && lastNearIdx !== null) {
          const dwell = Date.now() - (approachTime ?? 0)
          const holeScores = scoresRef.current[lastNearIdx] ?? []
          const activePlayers = setupRef.current.players.filter(p => p.name.trim())
          const alreadyScored = activePlayers.every((_, pi) => holeScores[pi] !== null)
          if (dwell >= MIN_DWELL_MS && !alreadyScored) {
            addLog('EXIT', { hole: lastNearIdx, lat: +lat.toFixed(5), lng: +lng.toFixed(5), dwellMs: dwell })
            startListeningRef.current?.(lastNearIdx)
          } else {
            addLog('EXIT_SKIP', { hole: lastNearIdx, dwellMs: dwell, reason: alreadyScored ? 'scored' : 'dwell' })
          }
          lastNearIdx = null
          approachTime = null
        }
      },
      (err) => addLog('GPS_ERR', { code: err.code, msg: err.message }),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [addLog])

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

  const captureScorecard = useCallback(() => {
    const activePlayers = setup.players.filter(p => p.name.trim())
    const nP = activePlayers.length || 1
    const COL_W = 38, NAME_W = 64, LEFT_W = 70
    const ROW_H = 18, HEAD_H = 28, PAD = 8
    const width = LEFT_W + NAME_W * nP + PAD * 2
    const rows = 18 + 3
    const height = HEAD_H + ROW_H * rows + PAD * 2 + 40

    const canvas = document.createElement('canvas')
    canvas.width = width * 2; canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const drawRow = (y, cols, bg, fg) => {
      ctx.fillStyle = bg
      ctx.fillRect(PAD, y, width - PAD * 2, ROW_H)
      ctx.fillStyle = fg
      ctx.font = '10px monospace'
      ctx.textBaseline = 'middle'
      cols.forEach((txt, i) => {
        const x = i === 0 ? PAD + 2 : PAD + LEFT_W + NAME_W * (i - 1) + NAME_W / 2
        ctx.textAlign = i === 0 ? 'left' : 'center'
        ctx.fillText(String(txt ?? '—'), x, y + ROW_H / 2)
      })
    }

    ctx.fillStyle = '#166534'; ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Bramley Golf Club', width / 2, PAD + HEAD_H / 2)

    drawRow(PAD + HEAD_H, ['H  P  SI', ...activePlayers.map(p => p.name)], '#166534', '#ffffff')

    holes.forEach((h, hi) => {
      const playerCols = activePlayers.map((_, pi) => {
        const sc = scores[hi][pi]
        const pts = holeData[hi].playerPts[pi]
        return sc !== null ? `${sc}(${pts ?? 0})` : '—'
      })
      const bg = hi === currentHole ? '#fef9c3' : hi % 2 === 0 ? '#ffffff' : '#f9fafb'
      drawRow(PAD + HEAD_H + ROW_H * (hi + 1), [`${h.hole}  ${h.par}  ${h.si}`, ...playerCols], bg, '#111827')
    })

    const subY = PAD + HEAD_H + ROW_H * 19
    drawRow(subY,             ['Out',   ...activePlayers.map((_, pi) => outPts[pi])],   '#f0fdf4', '#166534')
    drawRow(subY + ROW_H,     ['In',    ...activePlayers.map((_, pi) => inPts[pi])],    '#f0fdf4', '#166534')
    drawRow(subY + ROW_H * 2, ['Total', ...activePlayers.map((_, pi) => totalPts[pi])], '#166534', '#ffffff')

    canvas.toBlob(async (blob) => {
      const file = new File([blob], `scorecard-${new Date().toISOString().slice(0,10)}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Scorecard' })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
      }
    }, 'image/png')
  }, [setup, scores, holeData, outPts, inPts, totalPts, currentHole])

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
        <button className="start-btn" style={{marginTop:'0.5rem',background:'#374151'}} onClick={() => setShowLog(v => !v)}>
          {showLog ? 'Hide Log' : `GPS Log (${gpsLog.length} events)`}
        </button>
        {showLog && (
          <div className="log-overlay" style={{position:'static',marginTop:'0.5rem'}}>
            <div className="log-toolbar">
              <span>GPS + Tasker Log</span>
              <button onClick={() => { localStorage.removeItem(GPS_LOG_KEY); setGpsLog([]) }}>Clear</button>
            </div>
            <div className="log-body" style={{maxHeight:'50vh'}}>
              {gpsLog.length === 0
                ? <div className="log-empty">No events yet</div>
                : [...gpsLog].reverse().map((e, i) => (
                  <div key={i} className={`log-entry log-${e.event.toLowerCase()}`}>
                    <span className="log-ts">{e.ts}</span>
                    <span className="log-ev">{e.event}</span>
                    {e.hole !== undefined && <span>H{e.hole + 1}</span>}
                    {e.lat !== undefined && <span className="log-pos">{e.lat},{e.lng}</span>}
                    {e.transcript && <span className="log-tx">"{e.transcript}"</span>}
                    {e.scores && e.scores !== 'none' && <span className="log-sc">→ {e.scores}</span>}
                    {e.permission && <span className="log-tx">{e.permission}</span>}
                    {e.msg && <span className="log-tx">{e.msg}</span>}
                  </div>
                ))
              }
            </div>
          </div>
        )}
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
        <button className="sc-setup" onClick={() => startListening()}>Test</button>
        <button className="sc-setup" onClick={() => setShowLog(v => !v)}>Log</button>
        <button className="sc-done" onClick={() => { captureScorecard(); setPhase('finished') }}>Done</button>
        <button className="sc-back" onClick={() => { localStorage.removeItem(SETUP_KEY); setSetup(DEFAULT_SETUP()); setPhase('setup') }}>Setup</button>
        <span className="version-tag">v1.63</span>
      </div>

      {voiceMsg && <div className={`voice-banner ${voiceMsg.startsWith('✓') ? 'confirm' : 'listening'}`}>{voiceMsg}</div>}
      {voiceHeard && <div className="voice-banner debug">RAW: "{voiceHeard}"</div>}

      {showLog && (
        <div className="log-overlay">
          <div className="log-toolbar">
            <span>GPS + Tasker Log ({gpsLog.length})</span>
            <button onClick={() => { localStorage.removeItem(GPS_LOG_KEY); setGpsLog([]) }}>Clear</button>
            <button onClick={() => setShowLog(false)}>✕</button>
          </div>
          <div className="log-body">
            {gpsLog.length === 0
              ? <div className="log-empty">No events yet</div>
              : [...gpsLog].reverse().map((e, i) => (
                <div key={i} className={`log-entry log-${e.event.toLowerCase()}`}>
                  <span className="log-ts">{e.ts}</span>
                  <span className="log-ev">{e.event}</span>
                  {e.hole !== undefined && <span>H{e.hole + 1}</span>}
                  {e.lat !== undefined && <span className="log-pos">{e.lat},{e.lng}</span>}
                  {e.transcript && <span className="log-tx">"{e.transcript}"</span>}
                  {e.scores && e.scores !== 'none' && <span className="log-sc">→ {e.scores}</span>}
                  {e.permission && <span className="log-tx">{e.permission}</span>}
                  {e.msg && <span className="log-tx">{e.msg}</span>}
                </div>
              ))
            }
          </div>
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
