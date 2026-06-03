import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://www.bramleygolfclub.co.uk'

function parseCookies(headers) {
  const raw = headers['set-cookie'] || []
  return raw.map(c => c.split(';')[0]).join('; ')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { memberId, pin, tees, date, hcap, scores } = req.body

  if (!memberId || !pin) {
    return res.status(400).json({ error: 'Member ID and PIN are required' })
  }

  try {
    // 1. Fetch login page to get CSRF token
    const loginPage = await axios.get(`${BASE}/login.php`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 8000,
    })
    const $ = cheerio.load(loginPage.data)
    const csrf = $('input[name="_csrf_token"]').val()
    let cookie = parseCookies(loginPage.headers)

    // 2. POST login
    const loginParams = new URLSearchParams({
      task: 'login', topmenu: '1',
      memberid: memberId, pin,
      cachemid: '1', _csrf_token: csrf, Submit: 'Login',
    })
    const loginRes = await axios.post(`${BASE}/login.php`, loginParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        Cookie: cookie,
      },
      maxRedirects: 5,
      timeout: 8000,
    })
    cookie = parseCookies(loginRes.headers) || cookie

    if (loginRes.data.includes('memberid') && loginRes.data.includes('pin')) {
      return res.status(401).json({ error: 'Login failed — check credentials' })
    }

    // 3. Accept consent (some sessions require this)
    await axios.get(`${BASE}/ttbconsent.php?action=accept`, {
      headers: { Cookie: cookie },
      timeout: 8000,
    }).catch(() => {})

    // 4. POST score to editround.php
    const scoreParams = new URLSearchParams({
      roundid: '-1', courseid: '1',
      tees: String(tees),
      date,
      hcap: String(hcap),
      update: '1',
    })
    scores.forEach((s, i) => scoreParams.set(`score_${i + 1}`, String(s ?? 0)))

    const scoreRes = await axios.post(`${BASE}/editround.php`, scoreParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        Cookie: cookie,
      },
      maxRedirects: 5,
      timeout: 10000,
    })

    // Check for error indicators in response
    if (scoreRes.data.includes('login.php') || scoreRes.data.includes('INVALID')) {
      return res.status(401).json({ error: 'Session expired — login failed' })
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
