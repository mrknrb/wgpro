// Background service worker
// Handles auth token refresh, relays messages between popup and content script,
// and drives periodic auto-scraping via chrome.alarms.

const ALARM_NAME = 'auto-scrape'
const APP_URL = 'https://wgpro.vercel.app'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Relay scrape progress/done/error from content script to popup
  if (['SCRAPE_PROGRESS', 'SCRAPE_DONE', 'SCRAPE_ERROR'].includes(message.type)) {
    if (message.type === 'SCRAPE_PROGRESS') {
      console.log('[WGPro BG] progress:', message.message)
    }
    if (message.type === 'SCRAPE_DONE') {
      const now = new Date().toISOString()
      chrome.storage.local.set({ last_scrape_time: now })
      console.log('[WGPro BG] SCRAPE_DONE — saved last_scrape_time:', now, '| inserted:', message.inserted)
    }
    if (message.type === 'SCRAPE_ERROR') {
      console.warn('[WGPro BG] SCRAPE_ERROR:', message.message)
    }
    chrome.runtime.sendMessage(message).catch(() => {})
  }
  return true
})

// Fires when a scheduled alarm goes off
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return
  console.log('[WGPro BG] Alarm fired: auto-scrape at', new Date().toLocaleTimeString())
  await triggerAutoScrape()
})

async function triggerAutoScrape() {
  console.log('[WGPro BG] triggerAutoScrape: reading storage...')
  const stored = await chrome.storage.local.get([
    'access_token',
    'selected_session_id',
    'selected_session_wg_ad_id',
    'selected_session_cutoff_date',
  ])

  if (!stored.access_token || !stored.selected_session_wg_ad_id) {
    console.warn('[WGPro BG] triggerAutoScrape: missing token or wg_ad_id — aborting')
    return
  }
  console.log('[WGPro BG] triggerAutoScrape: session wg_ad_id =', stored.selected_session_wg_ad_id)

  // Find any open wg-gesucht tab that has the content script injected
  let tabId = null
  console.log('[WGPro BG] triggerAutoScrape: searching for wg-gesucht tab...')
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.wg-gesucht.de/*' })
    if (tabs.length) {
      tabId = tabs[0].id
      console.log('[WGPro BG] triggerAutoScrape: found tab id =', tabId, 'url =', tabs[0].url)
    }
  } catch (_) {}

  if (!tabId) {
    console.warn('[WGPro BG] triggerAutoScrape: no wg-gesucht tab open — skipping this run')
    return
  }

  console.log('[WGPro BG] triggerAutoScrape: sending START_SCRAPE to tab', tabId)
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_SCRAPE',
      token: stored.access_token,
      sessionId: stored.selected_session_id,
      wgAdId: stored.selected_session_wg_ad_id,
      cutoffDate: stored.selected_session_cutoff_date || null,
      appUrl: APP_URL,
    })
    console.log('[WGPro BG] triggerAutoScrape: START_SCRAPE sent OK')
  } catch (e) {
    console.warn('[WGPro BG] triggerAutoScrape: could not reach content script:', e.message)
  }
}
