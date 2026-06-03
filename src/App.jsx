import { useState, useCallback } from 'react'
import { holes, tees, courseHandicap, shotsOnHole, stablefordPoints } from './courseData.js'

const STORAGE_KEY = 'golf_round'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

export default function App() {
  const saved = loadSaved()
  const [screen, setScreen] = useState(saved ? 'card' : 'setup')
  const [index, setIndex] = useState(saved?.index ?? '')
  const [tee, setTee] = useState(saved?.tee ?? 'yellow')
  const [scores, setScores] = useState(saved?.scores ?? Array(18).fill(null))

  const playingHcp = index !== '' ? courseHandicap(Number(index), tee) : null

  const startRound = () => {
    const fresh = Array(18).fill(null)
    setScores(fresh)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, tee, scores: fresh }))
    setScreen('card')
  }

  const resetRound = () => {
    localStorage.removeItem(STORAGE_KEY)
    setScores(Array(18).fill(null))
    setScreen('setup')
  }

  const changeScore = useCallback((i, delta) => {
    setScores(prev => {
      const next = [...prev]
      const current = next[i]
      const par = holes[i].par
      if (delta > 0) {
        next[i] = current === null ? par : Math.min(current + 1, 15)
      } else {
        next[i] = current === null ? par : Math.max(current - 1, 1)
      }
      const updated = { index, tee, scores: next }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return next
    })
  }, [index, tee])

  if (screen === 'setup') {
    return (
      <div className="setup">
        <h1>⛳ Golf Stableford</h1>
        <div className="setup-card">
          <div className="field">
            <label>Handicap Index</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="54"
              placeholder="e.g. 18.4"
              value={index}
              onChange={e => setIndex(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Tee</label>
            <div className="tee-options">
              {['white', 'yellow'].map(t => (
                <button
                  key={t}
                  className={`tee-btn ${t} ${tee === t ? 'active' : ''}`}
                  onClick={() => setTee(t)}
                >
                  {tees[t].label}
                </button>
              ))}
            </div>
          </div>
          {index !== '' && (
            <div style={{ fontSize: '0.85rem', color: '#4b5563', textAlign: 'center' }}>
              Course handicap: <strong>{courseHandicap(Number(index), tee)}</strong>
              &nbsp;·&nbsp;{tees[tee].label} tees ({tees[tee].rating} / {tees[tee].slope})
            </div>
          )}
          <button
            className="start-btn"
            disabled={index === '' || isNaN(Number(index))}
            onClick={startRound}
          >
            Start Round
          </button>
        </div>
      </div>
    )
  }

  // ── Scorecard ──
  const holeData = holes.map((h, i) => {
    const shots = playingHcp !== null ? shotsOnHole(playingHcp, h.si) : 0
    const pts = stablefordPoints(scores[i], h.par, shots)
    return { ...h, shots, pts }
  })

  const frontNine = holeData.slice(0, 9)
  const backNine  = holeData.slice(9)

  const sumPts = arr => arr.reduce((acc, h) => acc + (h.pts ?? 0), 0)
  const totalPts = sumPts(holeData)
  const outPts   = sumPts(frontNine)
  const inPts    = sumPts(backNine)

  const playedHoles = holeData.filter(h => h.pts !== null).length
  const projectedPts = playedHoles > 0 ? Math.round(totalPts * 18 / playedHoles) : null

  return (
    <div className="scorecard-screen">
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="course-name">{tees[tee].label} tees · Hcp {playingHcp}</span>
          <span className="hcp-info">
            Index {index}
            {projectedPts !== null && playedHoles < 18 &&
              <> · proj. {projectedPts} pts</>}
          </span>
        </div>
        <div className="total-badge">
          <span className="pts-label">Points</span>
          <span className="pts-value">{totalPts}</span>
        </div>
        <button className="reset-btn" onClick={resetRound}>↩ Reset</button>
      </div>

      <HoleGroup holes={frontNine} startIdx={0} label="OUT" pts={outPts} tee={tee} scores={scores} onChange={changeScore} />
      <HoleGroup holes={backNine}  startIdx={9} label="IN"  pts={inPts}  tee={tee} scores={scores} onChange={changeScore} />

      <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', borderTop: '2px solid #166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>TOTAL</span>
        <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#166534' }}>{totalPts} pts</span>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  )
}

function HoleGroup({ holes, startIdx, label, pts, tee, scores, onChange }) {
  return (
    <>
      {holes.map((h, i) => (
        <HoleRow
          key={h.hole}
          h={h}
          idx={startIdx + i}
          tee={tee}
          score={scores[startIdx + i]}
          onChange={onChange}
        />
      ))}
      <div className="totals-row">
        <span className="label" style={{ gridColumn: '1 / 3' }}>{label}</span>
        <span />
        <span className="val" style={{ gridColumn: '4 / 5' }} />
        <span className="val" style={{ gridColumn: '5 / 6' }}>{pts}</span>
      </div>
    </>
  )
}

function HoleRow({ h, idx, tee, score, onChange }) {
  const pts = h.pts
  const ptsClass = pts === null ? 'pts-empty' : pts >= 4 ? 'pts-4' : pts === 3 ? 'pts-3' : pts === 2 ? 'pts-2' : pts === 1 ? 'pts-1' : 'pts-0'

  return (
    <div className="hole-row">
      <span className="hole-num">{h.hole}</span>
      <span className="hole-par" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>p{h.par}</span>
        <span style={{ fontSize: '0.6rem', color: '#d1d5db' }}>si{h.si}</span>
        {h.shots > 0 && (
          <div className="shots-dots">
            {Array.from({ length: h.shots }).map((_, k) => <span key={k} className="dot" />)}
          </div>
        )}
      </span>
      <span className="hole-yards">{tee === 'white' ? h.white : h.yellow}y</span>

      <div className="score-input-wrap">
        <button className="score-btn" onPointerDown={() => onChange(idx, -1)}>−</button>
        <span className={`score-display ${score === null ? 'empty' : ''}`}>
          {score === null ? '—' : score}
        </span>
        <button className="score-btn" onPointerDown={() => onChange(idx, +1)}>+</button>
      </div>

      <div className={`pts-chip ${ptsClass}`}>
        {pts === null ? '·' : pts}
      </div>
    </div>
  )
}
