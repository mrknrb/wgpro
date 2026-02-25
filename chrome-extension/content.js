/**
 * Content script injected into all https://www.wg-gesucht.de/* pages.
 *
 * Responsibilities:
 * - Respond to START_SCRAPE: paginate through conversation list filtered by
 *   ad_id, fetch each conversation's messages, upload to app API.
 *
 * Session is selected in the popup and passed via START_SCRAPE.
 * Session detection from URL is no longer required.
 *
 * Conversation list URL:
 *   /nachrichten.html?filter_type=4&ad_id=<wgAdId>&page=<N>
 *
 * Conversation page URL:
 *   /nachricht.html?nachrichten-id=<conversationId>&list=1
 *
 * Key selectors (confirmed from live HTML):
 *   Conversation item: .list_item_public_name[data-conversation_id]
 *     - data-conversation_id  → nachrichten-id
 *     - last_message_id from href fragment #last_message_id_XXXX
 *     - .latest_message_timestamp_list → date of latest message (stop condition)
 *   Message:  [id^="last_message_id_"]
 *     - .my_message class     → sent by the logged-in user (not from applicant)
 *     - .message_content      → message text
 *     - sibling .latest_message_timestamp → date string
 */

const WGG_BASE = 'https://www.wg-gesucht.de'

let appUrl = null
let authToken = null

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Convert German date "DD.MM.YYYY" to ISO "YYYY-MM-DD". Returns input unchanged if not matching. */
function parseGermanDate(str) {
  if (!str) return null
  const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return str
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function sendProgress(message) {
  chrome.runtime.sendMessage({ type: 'SCRAPE_PROGRESS', message })
}

function sendError(message) {
  chrome.runtime.sendMessage({ type: 'SCRAPE_ERROR', message })
}

async function fetchHtmlDoc(url) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const html = await res.text()
  return new DOMParser().parseFromString(html, 'text/html')
}

// ─── Conversation list parsing ────────────────────────────────────────────────

/**
 * Extract conversation entries from a nachrichten.html page.
 * Returns array of { conversationId, lastMessageId, name, photoUrl, href, latestDate }
 *
 * lastMessageId is extracted from the link href fragment #last_message_id_XXXX.
 * latestDate is the German date string from .latest_message_timestamp_list (e.g. "06.02.2025").
 */
function parseConversationListPage(doc) {
  const items = []
  const seen = new Set()

  // Each conversation has a name span with data-conversation_id
  const nameSpans = doc.querySelectorAll('.list_item_public_name[data-conversation_id]')

  for (const span of nameSpans) {
    const conversationId = span.getAttribute('data-conversation_id')
    if (!conversationId || seen.has(conversationId)) continue
    seen.add(conversationId)


    // Walk up to find the container that holds the timestamp and links
    let container = span.parentElement
    
    const name = container.textContent?.trim() || null
    for (let i = 0; i < 6; i++) {
      if (!container || container === doc.body) break
      if (container.querySelector('.latest_message_timestamp_list')) break
      container = container.parentElement
    }

    // Extract last_message_id from link href fragment
    const link = container?.querySelector('a.link-conversation-list[href*="nachrichten-id"]')
    const rawHref = link?.getAttribute('href') || ''
    const fragMatch = rawHref.match(/#last_message_id_(\d+)/)
    const lastMessageId = fragMatch ? fragMatch[1] : null

    // Build clean href (strip fragment — we don't need it for fetching)
    const hrefNoFrag = rawHref.replace(/#.*$/, '')
    const fullHref = hrefNoFrag.startsWith('http')
      ? hrefNoFrag
      : `${WGG_BASE}${hrefNoFrag}`

    // Photo is in the sibling col-xs-3, so go up to the parent .row
    const row = container?.parentElement
    const photoImg = row?.querySelector('img.img-conversation-list') || row?.querySelector('img[src^="http"]')
    const photoUrl = photoImg?.getAttribute('src') || null

    const dateEl = container?.querySelector('.latest_message_timestamp_list')
    const latestDate = dateEl?.textContent?.trim() || null

    items.push({ conversationId, lastMessageId, name, photoUrl, href: fullHref, latestDate })
  }
  return items
}

/**
 * Returns true if there is a "next page" link.
 * WG Gesucht uses: <a href="#page-2" class="page-link next">
 */
function hasNextPage(doc) {
  if (doc.querySelector('a.page-link.next')) return true
  // Fallback for other pagination styles
  const pagination = doc.querySelector('.simple-pagination, ul.pagination')
  if (!pagination) return false
  return !!pagination.querySelector('a.next, li.next:not(.disabled) a')
}

// ─── Message parsing ──────────────────────────────────────────────────────────

/**
 * Parse messages from a nachricht.html page.
 *
 * Messages are ordered oldest → newest (top → bottom).
 * knownLastMessageId = the newest message ID we already have stored.
 * We collect ONLY messages that appear after that ID.
 * If knownLastMessageId is not found on the page (first scrape or page
 * truncated too aggressively), we collect all visible messages.
 */
function parseMessagesFromDoc(doc, knownLastMessageId) {
  const msgEls = Array.from(doc.querySelectorAll('[id^="last_message_id_"]'))

  // Find the index of the already-known last message
  const knownIndex = knownLastMessageId
    ? msgEls.findIndex(el => el.id === `last_message_id_${knownLastMessageId}`)
    : -1

  // Start collecting from the element after the known one (or from index 0)
  const startFrom = knownIndex >= 0 ? knownIndex + 1 : 0

  const messages = []
  for (let i = startFrom; i < msgEls.length; i++) {
    const el = msgEls[i]
    const msgId = el.id.replace('last_message_id_', '')
    if (!msgId) continue

    // Own messages have the "my_message" class
    const isOwnMessage = el.classList.contains('my_message')

    const textEl = el.querySelector('.message_content')
    const content = textEl?.textContent?.trim() || el.textContent?.trim() || ''
    if (!content) continue

    // Timestamp lives in a sibling .latest_message_timestamp inside the same
    // .last_message_selector wrapper. Take only the raw text node to avoid
    // picking up icon spans (mdi-check-all etc.)
    const wrapper = el.closest('.last_message_selector') || el.parentElement
    const timeEl = wrapper?.querySelector('.latest_message_timestamp')
    const sentAt = timeEl
      ? Array.from(timeEl.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim())
          .find(t => t.length > 0) || timeEl.textContent.trim()
      : null

    messages.push({
      wg_message_id: msgId,
      is_from_applicant: !isOwnMessage,
      content,
      sent_at: parseGermanDate(sentAt),
    })
  }
  return messages
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetch a map of { wg_conversation_id → last_message_id } for already-known
 * applicants in this session.
 */
async function getKnownLastMessages(sessionId) {
  const res = await fetch(`${appUrl}/api/sessions/${sessionId}/applicants?minimal=true`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  })
  if (!res.ok) return {}
  const applicants = await res.json()
  const map = {}
  for (const a of applicants) {
    if (a.wg_conversation_id && a.last_message_id) {
      map[a.wg_conversation_id] = a.last_message_id
    }
  }
  return map
}

async function uploadApplicants(sessionId, applicantsData) {
  const res = await fetch(`${appUrl}/api/scrape/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ session_id: sessionId, applicants: applicantsData }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || res.statusText)
  }
  return res.json()
}

// ─── Main scrape flow ─────────────────────────────────────────────────────────

async function startScrape(sessionId, wgAdId, cutoffDate) {
  try {
    sendProgress('Loading known messages from app...')
    const knownLastMessages = await getKnownLastMessages(sessionId)

    // Parse cutoff as a comparable ISO date string (e.g. "2025-02-01")
    const cutoff = cutoffDate || null

    const applicantsData = []
    let page = 1
    let totalConvs = 0
    let skipped = 0
    // Track conversation IDs seen across all pages to detect when the server
    // returns the same page repeatedly (JS-only pagination → infinite loop guard).
    const seenConversationIds = new Set()

    // Paginate through the conversation list.
    // WG Gesucht's "next" link uses a JS hash (#page-2) so we can't reliably
    // detect it from raw HTML. Instead we always try the next page and stop
    // when the page is empty or returns only already-seen conversations.
    while (true) {
      const listUrl = `${WGG_BASE}/nachrichten.html?filter_type=4&ad_id=${wgAdId}&page=${page}`
      sendProgress(`Fetching conversation list — page ${page}...`)

      const listDoc = await fetchHtmlDoc(listUrl)
      const conversations = parseConversationListPage(listDoc)

      if (!conversations.length) {
        sendProgress(`Page ${page} is empty. Done scanning.`)
        break
      }

      // Stop if every conversation on this page was already seen on a previous page
      // (server is repeating itself — pagination is client-side only).
      const newConversations = conversations.filter(c => !seenConversationIds.has(c.conversationId))
      if (!newConversations.length) {
        sendProgress(`Page ${page}: no new conversations (server returned duplicates). Done scanning.`)
        break
      }
      for (const c of conversations) seenConversationIds.add(c.conversationId)

      totalConvs += newConversations.length

      for (let i = 0; i < newConversations.length; i++) {
        const conv = newConversations[i]
        const knownLastId = knownLastMessages[conv.conversationId]

        // Skip conversations whose latest message is before the cutoff date
        if (cutoff && conv.latestDate) {
          const isoDate = parseGermanDate(conv.latestDate)
          if (isoDate && isoDate < cutoff) {
            skipped++
            sendProgress(
              `[p${page} ${i + 1}/${newConversations.length}] Skip: ${conv.name || conv.conversationId} (${conv.latestDate} < cutoff)`
            )
            continue
          }
        }

        // Skip conversations with no new messages
        if (knownLastId && conv.lastMessageId === knownLastId) {
          skipped++
          sendProgress(
            `[p${page} ${i + 1}/${newConversations.length}] Skip: ${conv.name || conv.conversationId} (up to date)`
          )
          continue
        }

        sendProgress(
          `[p${page} ${i + 1}/${newConversations.length}] Scraping: ${conv.name || conv.conversationId}...`
        )

        try {
          const msgDoc = await fetchHtmlDoc(conv.href)
          const messages = parseMessagesFromDoc(msgDoc, knownLastId || null)

          applicantsData.push({
            wg_conversation_id: conv.conversationId,
            name: conv.name,
            photo_url: conv.photoUrl,
            // last_message_id from list is always the real newest message ID
            last_message_id: conv.lastMessageId,
            messages,
          })

          sendProgress(
            `  → ${messages.length} new message(s) found`
          )

          await delay(400)
        } catch (e) {
          sendProgress(`  Error for ${conv.conversationId}: ${e.message}`)
        }
      }

      // If every conversation on this page is older than the cutoff, stop paginating —
      // older pages will only have even older conversations.
      if (cutoff) {
        const allOld = newConversations.every(c => {
          if (!c.latestDate) return false // unknown date: keep going
          const isoDate = parseGermanDate(c.latestDate)
          return isoDate && isoDate < cutoff
        })
        if (allOld) {
          sendProgress(`Page ${page}: all conversations older than cutoff date (${cutoff}). Stopping.`)
          break
        }
      }

      // Always advance to the next page (pagination links are JS-driven and
      // unreliable in raw-fetched HTML; empty/duplicate page above will stop us).
      page++
      await delay(500)
    }

    if (!applicantsData.length) {
      sendProgress(`All ${totalConvs} conversation(s) are up to date. Nothing to upload.`)
      chrome.runtime.sendMessage({ type: 'SCRAPE_DONE', inserted: 0 })
      return
    }

    sendProgress(`Uploading ${applicantsData.length} applicant(s)...`)
    const result = await uploadApplicants(sessionId, applicantsData)
    chrome.runtime.sendMessage({
      type: 'SCRAPE_DONE',
      inserted: result.insertedApplicants ?? applicantsData.length,
    })
  } catch (e) {
    sendError(e.message)
  }
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'START_SCRAPE') {
    appUrl = message.appUrl
    authToken = message.token
    startScrape(message.sessionId, message.wgAdId, message.cutoffDate || null)
  }
})
