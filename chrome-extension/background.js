// Background service worker
// Handles auth token refresh and relays messages between popup and content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Relay scrape progress/done/error from content script to popup
  if (['SCRAPE_PROGRESS', 'SCRAPE_DONE', 'SCRAPE_ERROR'].includes(message.type)) {
    // Forward to all extension views (popup)
    chrome.runtime.sendMessage(message).catch(() => {})
  }
  return true
})
