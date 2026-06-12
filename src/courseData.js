// Course data extracted from scorecard
export const holes = [
  { hole: 1,  par: 4, si: 17, white: 293, yellow: 263, lat: 51.1992704, lng: -0.5700884 },
  { hole: 2,  par: 4, si: 1,  white: 398, yellow: 370, lat: 51.1969208, lng: -0.5745511 },
  { hole: 3,  par: 3, si: 7,  white: 196, yellow: 196, lat: 51.1973889, lng: -0.5720472 },
  { hole: 4,  par: 3, si: 15, white: 168, yellow: 151, lat: 51.1965518, lng: -0.5729707 },
  { hole: 5,  par: 4, si: 9,  white: 345, yellow: 302, lat: 51.1947641, lng: -0.5712167 },
  { hole: 6,  par: 4, si: 11, white: 333, yellow: 316, lat: 51.1932631, lng: -0.5737412 },
  { hole: 7,  par: 4, si: 3,  white: 409, yellow: 400, lat: 51.1939201, lng: -0.5689874 },
  { hole: 8,  par: 4, si: 13, white: 309, yellow: 296, lat: 51.1948396, lng: -0.5665366 },
  { hole: 9,  par: 4, si: 5,  white: 393, yellow: 367, lat: 51.1972167, lng: -0.5705712 },
  { hole: 10, par: 4, si: 10, white: 335, yellow: 326, lat: 51.1944396, lng: -0.5686489 },
  { hole: 11, par: 4, si: 14, white: 317, yellow: 289, lat: 51.1960647, lng: -0.5708553 },
  { hole: 12, par: 3, si: 12, white: 175, yellow: 175, lat: 51.1977739, lng: -0.5711884 },
  { hole: 13, par: 5, si: 6,  white: 485, yellow: 478, lat: 51.1952106, lng: -0.5667854 },
  { hole: 14, par: 3, si: 18, white: 144, yellow: 140, lat: 51.1957156, lng: -0.5665411 },
  { hole: 15, par: 5, si: 2,  white: 517, yellow: 486, lat: 51.198098,  lng: -0.5700676 },
  { hole: 16, par: 4, si: 4,  white: 440, yellow: 431, lat: 51.1959301, lng: -0.5636342 },
  { hole: 17, par: 3, si: 16, white: 188, yellow: 124, lat: 51.1963177, lng: -0.5629711 },
  { hole: 18, par: 4, si: 8,  white: 446, yellow: 436, lat: 51.1984326, lng: -0.5670658 },
]

// Haversine distance in metres between two lat/lng points
export function distanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Return 0-based hole index if within threshold metres of a green, else null
export function nearestGreen(lat, lng, thresholdMetres = 6) {
  let best = null, bestDist = Infinity
  for (let i = 0; i < holes.length; i++) {
    const d = distanceMetres(lat, lng, holes[i].lat, holes[i].lng)
    if (d < bestDist) { bestDist = d; best = i }
  }
  return bestDist <= thresholdMetres ? best : null
}

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
