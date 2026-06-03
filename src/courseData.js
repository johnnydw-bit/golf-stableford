// Course data extracted from scorecard
export const holes = [
  { hole: 1,  par: 4, si: 17, white: 293, yellow: 263 },
  { hole: 2,  par: 4, si: 1,  white: 398, yellow: 370 },
  { hole: 3,  par: 3, si: 7,  white: 196, yellow: 196 },
  { hole: 4,  par: 3, si: 15, white: 168, yellow: 151 },
  { hole: 5,  par: 4, si: 9,  white: 345, yellow: 302 },
  { hole: 6,  par: 4, si: 11, white: 333, yellow: 316 },
  { hole: 7,  par: 4, si: 3,  white: 409, yellow: 400 },
  { hole: 8,  par: 4, si: 13, white: 309, yellow: 296 },
  { hole: 9,  par: 4, si: 5,  white: 393, yellow: 367 },
  { hole: 10, par: 4, si: 10, white: 335, yellow: 326 },
  { hole: 11, par: 4, si: 14, white: 317, yellow: 289 },
  { hole: 12, par: 3, si: 12, white: 175, yellow: 175 },
  { hole: 13, par: 5, si: 6,  white: 485, yellow: 478 },
  { hole: 14, par: 3, si: 18, white: 144, yellow: 140 },
  { hole: 15, par: 5, si: 2,  white: 517, yellow: 486 },
  { hole: 16, par: 4, si: 4,  white: 440, yellow: 431 },
  { hole: 17, par: 3, si: 16, white: 188, yellow: 124 },
  { hole: 18, par: 4, si: 8,  white: 446, yellow: 436 },
]

// Men's course rating & slope per tee
export const tees = {
  white:  { label: 'White',  rating: 69.4, slope: 123, par: 69 },
  yellow: { label: 'Yellow', rating: 67.6, slope: 118, par: 69 },
}

// Course handicap = round(index × slope/113 + (rating - par))
export function courseHandicap(index, tee) {
  const { rating, slope, par } = tees[tee]
  return Math.round(index * (slope / 113) + (rating - par))
}

// Shots received on a hole given playing handicap and stroke index
export function shotsOnHole(playingHcp, si) {
  let shots = 0
  if (si <= playingHcp)      shots++
  if (si <= playingHcp - 18) shots++
  if (si <= playingHcp - 36) shots++
  return shots
}

// Stableford points for a hole (0 if no score entered)
export function stablefordPoints(gross, par, shots) {
  if (gross === null || gross === undefined || gross === '') return null
  const net = gross - shots
  return Math.max(0, par - net + 2)
}
