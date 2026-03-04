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

  // Load auto-scrape settings + last scrape time
  const autoSettings = await chrome.storage.local.get(['auto_scrape_enabled', 'auto_scrape_interval', 'last_scrape_time'])
  const savedInterval = autoSettings.auto_scrape_interval || 30
  let autoEnabled = !!autoSettings.auto_scrape_enabled
  const lastScrapeText = autoSettings.last_scrape_time
    ? `Last scrape: ${new Date(autoSettings.last_scrape_time).toLocaleString()}`
    : ''
  let nextRunText = ''
  if (autoEnabled) {
    const alarm = await chrome.alarms.get('auto-scrape')
    if (alarm) {
      nextRunText = `Next run: ${new Date(alarm.scheduledTime).toLocaleTimeString()}`
    }
  }

  document.getElementById('content').innerHTML = `
    <div class="field">
      <label>Session</label>
      <select id="session-select">${options.join('')}</select>
    </div>
    <div class="field" style="margin-top:4px;">
      <label>Cutoff date <span style="color:#6b7280; font-weight:400;">(skip messages before)</span></label>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="date" id="cutoff-input" style="margin-bottom:0; flex:1;" />
        <button id="cutoff-save-btn" style="width:auto; padding:8px 12px; font-size:12px;">Save</button>
      </div>
      <div id="cutoff-status" class="info" style="margin-top:4px; margin-bottom:0; display:none;"></div>
    </div>
    ${tabWarning}
    <div class="scrape-section">
      <button class="scrape-btn" id="scrape-btn" ${!wggTabAvailable ? 'disabled' : ''}>
        Scrape &amp; Sync Messages
      </button>
      <div class="status-box" id="status">Ready.</div>
      <div id="last-scrape" class="info" style="margin-top:4px; margin-bottom:0; ${lastScrapeText ? '' : 'display:none;'}">${lastScrapeText}</div>
    </div>
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid #1f2937;">
      <label style="color:#e5e5e5; font-size:13px; font-weight:600; display:block; margin-bottom:8px;">Auto-scrape</label>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
        <input type="number" id="interval-input" min="1" max="1440" value="${savedInterval}" style="width:70px; margin-bottom:0;" />
        <span style="color:#9ca3af; font-size:12px;">min interval</span>
      </div>
      <button id="auto-toggle-btn" class="${autoEnabled ? 'auto-off-btn' : 'auto-on-btn'}">
        ${autoEnabled ? 'Disable Auto-scrape' : 'Enable Auto-scrape'}
      </button>
      <div id="auto-next" class="info" style="margin-top:6px; margin-bottom:0; ${autoEnabled && nextRunText ? '' : 'display:none;'}">${nextRunText}</div>
    </div>
  `

  const sessionSelect = document.getElementById('session-select')
  const scrapeBtn = document.getElementById('scrape-btn')
  const statusEl = document.getElementById('status')

  function updateLastScrape() {
    const now = new Date()
    const el = document.getElementById('last-scrape')
    if (el) {
      el.textContent = `Last scrape: ${now.toLocaleString()}`
      el.style.display = 'block'
    }
  }

  // Persist selected session (including cutoff date, used by background auto-scrape)
  const persistSession = () => {
    const opt = sessionSelect.options[sessionSelect.selectedIndex]
    chrome.storage.local.set({
      selected_session_id: opt.value,
      selected_session_wg_ad_id: opt.getAttribute('data-wg-ad-id'),
      selected_session_cutoff_date: opt.getAttribute('data-cutoff-date') || null,
    })
  }
  sessionSelect.addEventListener('change', persistSession)
  // Persist on load if a session is already selected
  if (sessions.length) persistSession()

  // ── Cutoff date ─────────────────────────────────────────────────────────────
  const cutoffInput = document.getElementById('cutoff-input')
  const cutoffSaveBtn = document.getElementById('cutoff-save-btn')
  const cutoffStatus = document.getElementById('cutoff-status')

  function updateCutoffInput() {
    const opt = sessionSelect.options[sessionSelect.selectedIndex]
    cutoffInput.value = opt.getAttribute('data-cutoff-date') || ''
  }
  updateCutoffInput()
  sessionSelect.addEventListener('change', updateCutoffInput)

  cutoffSaveBtn.addEventListener('click', async () => {
    const opt = sessionSelect.options[sessionSelect.selectedIndex]
    const sessionId = opt.value
    const newCutoff = cutoffInput.value || null
    cutoffSaveBtn.disabled = true
    cutoffStatus.textContent = 'Saving...'
    cutoffStatus.style.display = 'block'
    try {
      const res = await fetch(`${APP_URL}/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scrape_cutoff_date: newCutoff }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      opt.setAttribute('data-cutoff-date', newCutoff || '')
      persistSession()
      cutoffStatus.textContent = 'Saved!'
      setTimeout(() => { cutoffStatus.style.display = 'none' }, 2000)
    } catch (e) {
      cutoffStatus.textContent = `Error: ${e.message}`
    }
    cutoffSaveBtn.disabled = false
  })

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
    console.log('[WGPro popup] manual scrape: sending START_SCRAPE, sessionId =', sessionId, 'wgAdId =', wgAdId)

    // Remove any previous listener
    const listener = (msg) => {
      if (msg.type === 'SCRAPE_PROGRESS') {
        statusEl.textContent = msg.message
      }
      if (msg.type === 'SCRAPE_DONE') {
        console.log('[WGPro popup] manual scrape: SCRAPE_DONE, inserted =', msg.inserted)
        updateLastScrape()
        statusEl.textContent = msg.inserted
          ? `Done! ${msg.inserted} applicant(s) synced.`
          : 'Done! Everything is already up to date.'
        scrapeBtn.disabled = false
        scrapeBtn.textContent = 'Scrape & Sync Messages'
        chrome.runtime.onMessage.removeListener(listener)
      }
      if (msg.type === 'SCRAPE_ERROR') {
        console.warn('[WGPro popup] manual scrape: SCRAPE_ERROR:', msg.message)
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

  // ── Auto-scrape toggle ──────────────────────────────────────────────────────
  const autoToggleBtn = document.getElementById('auto-toggle-btn')
  const intervalInput = document.getElementById('interval-input')
  const autoNextEl = document.getElementById('auto-next')

  autoToggleBtn.addEventListener('click', async () => {
    const interval = Math.max(1, parseInt(intervalInput.value) || 30)

    if (autoEnabled) {
      console.log('[WGPro popup] auto-scrape: disabling')
      await chrome.alarms.clear('auto-scrape')
      await chrome.storage.local.set({ auto_scrape_enabled: false })
      autoEnabled = false
      autoToggleBtn.textContent = 'Enable Auto-scrape'
      autoToggleBtn.className = 'auto-on-btn'
      autoNextEl.style.display = 'none'
    } else {
      console.log('[WGPro popup] auto-scrape: enabling with interval =', interval, 'min')
      await chrome.alarms.create('auto-scrape', { periodInMinutes: interval })
      await chrome.storage.local.set({ auto_scrape_enabled: true, auto_scrape_interval: interval })
      autoEnabled = true
      autoToggleBtn.textContent = 'Disable Auto-scrape'
      autoToggleBtn.className = 'auto-off-btn'
      const alarm = await chrome.alarms.get('auto-scrape')
      if (alarm) {
        autoNextEl.textContent = `Next run: ${new Date(alarm.scheduledTime).toLocaleTimeString()}`
        autoNextEl.style.display = 'block'
      }

      // Trigger an immediate first run
      if (wggTabAvailable) {
        const opt = sessionSelect.options[sessionSelect.selectedIndex]
        const wgAdId = opt.getAttribute('data-wg-ad-id')
        if (wgAdId) {
          statusEl.textContent = 'Auto-scrape: starting first run...'
          console.log('[WGPro popup] auto-scrape: immediate first run, wgAdId =', wgAdId)
          const listener = (msg) => {
            if (msg.type === 'SCRAPE_PROGRESS') statusEl.textContent = msg.message
            if (msg.type === 'SCRAPE_DONE') {
              console.log('[WGPro popup] auto-scrape first run: SCRAPE_DONE, inserted =', msg.inserted)
              updateLastScrape()
              statusEl.textContent = msg.inserted
                ? `Done! ${msg.inserted} applicant(s) synced.`
                : 'Done! Everything is already up to date.'
              chrome.runtime.onMessage.removeListener(listener)
            }
            if (msg.type === 'SCRAPE_ERROR') {
              console.warn('[WGPro popup] auto-scrape first run: SCRAPE_ERROR:', msg.message)
              statusEl.textContent = `Error: ${msg.message}`
              chrome.runtime.onMessage.removeListener(listener)
            }
          }
          chrome.runtime.onMessage.addListener(listener)
          try {
            await chrome.tabs.sendMessage(wggTabId, {
              type: 'START_SCRAPE',
              token,
              sessionId: opt.value,
              wgAdId,
              cutoffDate: opt.getAttribute('data-cutoff-date') || null,
              appUrl: APP_URL,
            })
          } catch (e) {
            console.warn('[WGPro popup] auto-scrape first run: could not reach content script:', e.message)
            statusEl.textContent = `Auto-scrape: could not reach content script: ${e.message}`
            chrome.runtime.onMessage.removeListener(listener)
          }
        }
      }
    }
  })
}

render()
