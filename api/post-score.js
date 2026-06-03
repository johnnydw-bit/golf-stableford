import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE = 'https://www.bramleygolfclub.co.uk'

const cookieJar = {}

function setCookies(header) {
  if (!header) return
  const headers = Array.isArray(header) ? header : [header]
  for (const cookie of headers) {
    const [kv] = cookie.split(';')
    const eqIdx = kv.indexOf('=')
    if (eqIdx > 0) cookieJar[kv.slice(0, eqIdx).trim()] = kv.slice(eqIdx + 1).trim()
  }
}

function getCookieHeader() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
}

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { memberId, pin, tees, date, hcap, scores } = req.body

  if (!memberId || !pin) {
    return res.status(400).json({ error: 'Member ID and PIN are required' })
  }

  try {
    // 1. GET login page — grab CSRF token and initial cookies
    const loginPage = await axios.get(`${BASE}/login.php`, {
      headers: { 'User-Agent': ua },
      validateStatus: s => s < 500,
      timeout: 8000,
    })
    setCookies(loginPage.headers['set-cookie'])

    const $ = cheerio.load(loginPage.data)
    const csrf = $('input[name="_csrf_token"]').val()
      || (loginPage.data.match(/name="_csrf_token"\s+value="([^"]+)"/) || [])[1]

    // 2. POST credentials — don't follow redirect, capture cookies
    const loginParams = new URLSearchParams({
      task: 'login', topmenu: '1',
      memberid: memberId, pin,
      cachemid: '1', _csrf_token: csrf ?? '', Submit: 'Login',
    })
    const loginRes = await axios.post(`${BASE}/login.php`, loginParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': ua,
        Cookie: getCookieHeader(),
      },
      maxRedirects: 0,
      validateStatus: s => s < 400 || s === 302,
      timeout: 8000,
    })
    setCookies(loginRes.headers['set-cookie'])

    // Check for failed login (redirected back to login page or body still shows login form)
    if (loginRes.data && loginRes.data.includes('memberid') && loginRes.data.includes('pin')) {
      return res.status(401).json({ error: 'Invalid Member ID or PIN' })
    }

    // 3. Accept consent
    const consentRes = await axios.get(`${BASE}/ttbconsent.php?action=accept`, {
      headers: { 'User-Agent': ua, Cookie: getCookieHeader() },
      validateStatus: s => s < 500,
      timeout: 8000,
    })
    setCookies(consentRes.headers['set-cookie'])

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
        'User-Agent': ua,
        Cookie: getCookieHeader(),
      },
      validateStatus: s => s < 500,
      timeout: 10000,
    })

    if (scoreRes.data.includes('login.php')) {
      return res.status(401).json({ error: 'Session lost — score not saved' })
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
