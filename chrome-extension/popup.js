const APP_URL = 'https://wgpro.vercel.app'
const SUPABASE_URL = 'https://pedsdhtkqzbifeevpszv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_XhqC14ZdCT7dl127Ur8B_A_V6VkQbzi'

const app = document.getElementById('app')

async function getStoredAuth() {
  return new Promise(resolve => {
    chrome.storage.local.get(['access_token', 'user_email', 'selected_session_id', 'selected_session_wg_ad_id'], resolve)
  })
}

async function render() {
  const stored = await getStoredAuth()
  if (!stored.access_token) {
    renderLogin()
  } else {
    renderMain(stored.user_email, stored.access_token, stored.selected_session_id, stored.selected_session_wg_ad_id)
  }
}

// ─── Login screen ─────────────────────────────────────────────────────────────

function renderLogin() {
  app.innerHTML = `
    <div>
      <div style="margin-bottom:12px">
        <label>Email</label>
        <input type="email" id="email" placeholder="you@example.com" />
      </div>
      <div style="margin-bottom:12px">
        <label>Password</label>
        <input type="password" id="password" placeholder="••••••••" />
      </div>
      <div id="error" class="error" style="display:none"></div>
      <button id="login-btn">Sign in</button>
    </div>
  `

  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const errorEl = document.getElementById('error')
    const btn = document.getElementById('login-btn')

    btn.disabled = true
    btn.textContent = 'Signing in...'
    errorEl.style.display = 'none'

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed')

      await chrome.storage.local.set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_email: email,
      })
      render()
    } catch (e) {
      errorEl.textContent = e.message
      errorEl.style.display = 'block'
      btn.disabled = false
      btn.textContent = 'Sign in'
    }
  })
}

// ─── Main screen ──────────────────────────────────────────────────────────────

async function renderMain(email, token, savedSessionId, savedWgAdId) {
  app.innerHTML = `
    <div class="user-bar">
      <span class="user-email">${email}</span>
      <button class="logout-btn" id="logout-btn">Logout</button>
    </div>
    <div id="content">
      <div class="status-box" id="status">Loading sessions...</div>
    </div>
  `

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['access_token', 'refresh_token', 'user_email', 'selected_session_id', 'selected_session_wg_ad_id'])
    render()
  })

  // Load sessions from app API
  let sessions = []
  try {
    const res = await fetch(`${APP_URL}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to load sessions')
    sessions = await res.json()
  } catch (e) {
    document.getElementById('content').innerHTML = `
      <div class="error">Could not load sessions: ${e.message}</div>
      <button id="retry-btn" style="margin-top:8px">Retry</button>
    `
    document.getElementById('retry-btn').addEventListener('click', () => renderMain(email, token, savedSessionId, savedWgAdId))
    return
  }

  if (!sessions.length) {
    document.getElementById('content').innerHTML = `
      <div class="info">No sessions found. Create a session in the app first.</div>
    `
    return
  }

  // Build session options
  const options = sessions.map(s => {
    const label = s.name ? `${s.name} (ad ${s.wg_ad_id || '?'})` : `Ad ${s.wg_ad_id || s.id}`
    const selected = s.id === savedSessionId ? 'selected' : ''
    return `<option value="${s.id}" data-wg-ad-id="${s.wg_ad_id || ''}" data-cutoff-date="${s.scrape_cutoff_date || ''}" ${selected}>${label}</option>`
  })

  // Check if user is on WG Gesucht
  let wggTabAvailable = false
  let wggTabId = null
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url?.includes('wg-gesucht.de')) {
      wggTabAvailable = true
      wggTabId = tab.id
    }
  } catch (_) {}

  // If no active wg-gesucht tab, try any wg-gesucht tab
  if (!wggTabAvailable) {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.wg-gesucht.de/*' })
      if (tabs.length) {
        wggTabAvailable = true
        wggTabId = tabs[0].id
      }
    } catch (_) {}
  }

  const tabWarning = wggTabAvailable
    ? ''
    : `<div class="warn">Open wg-gesucht.de in a tab and log in before scraping.</div>`

  document.getElementById('content').innerHTML = `
    <div class="field">
      <label>Session</label>
      <select id="session-select">${options.join('')}</select>
    </div>
    ${tabWarning}
    <div class="scrape-section">
      <button class="scrape-btn" id="scrape-btn" ${!wggTabAvailable ? 'disabled' : ''}>
        Scrape &amp; Sync Messages
      </button>
      <div class="status-box" id="status">Ready.</div>
    </div>
  `

  const sessionSelect = document.getElementById('session-select')
  const scrapeBtn = document.getElementById('scrape-btn')
  const statusEl = document.getElementById('status')

  // Persist selected session
  const persistSession = () => {
    const opt = sessionSelect.options[sessionSelect.selectedIndex]
    chrome.storage.local.set({
      selected_session_id: opt.value,
      selected_session_wg_ad_id: opt.getAttribute('data-wg-ad-id'),
    })
  }
  sessionSelect.addEventListener('change', persistSession)
  // Persist on load if a session is already selected
  if (sessions.length) persistSession()

  if (!wggTabAvailable) return

  scrapeBtn.addEventListener('click', async () => {
    const opt = sessionSelect.options[sessionSelect.selectedIndex]
    const sessionId = opt.value
    const wgAdId = opt.getAttribute('data-wg-ad-id')
    const cutoffDate = opt.getAttribute('data-cutoff-date') || null

    if (!wgAdId) {
      statusEl.textContent = 'Error: Selected session has no ad ID. Set wg_ad_id on the session first.'
      return
    }

    scrapeBtn.disabled = true
    scrapeBtn.textContent = 'Scraping...'
    statusEl.textContent = 'Starting...'

    // Remove any previous listener
    const listener = (msg) => {
      if (msg.type === 'SCRAPE_PROGRESS') {
        statusEl.textContent = msg.message
      }
      if (msg.type === 'SCRAPE_DONE') {
        statusEl.textContent = msg.inserted
          ? `Done! ${msg.inserted} applicant(s) synced.`
          : 'Done! Everything is already up to date.'
        scrapeBtn.disabled = false
        scrapeBtn.textContent = 'Scrape & Sync Messages'
        chrome.runtime.onMessage.removeListener(listener)
      }
      if (msg.type === 'SCRAPE_ERROR') {
        statusEl.textContent = `Error: ${msg.message}`
        scrapeBtn.disabled = false
        scrapeBtn.textContent = 'Scrape & Sync Messages'
        chrome.runtime.onMessage.removeListener(listener)
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    try {
      await chrome.tabs.sendMessage(wggTabId, {
        type: 'START_SCRAPE',
        token,
        sessionId,
        wgAdId,
        cutoffDate,
        appUrl: APP_URL,
      })
    } catch (e) {
      statusEl.textContent = `Could not reach content script: ${e.message}. Reload the wg-gesucht.de tab and try again.`
      scrapeBtn.disabled = false
      scrapeBtn.textContent = 'Scrape & Sync Messages'
      chrome.runtime.onMessage.removeListener(listener)
    }
  })
}

render()
