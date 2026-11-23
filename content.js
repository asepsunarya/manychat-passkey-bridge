/**
 * content.js — runs on every page (isolated world)
 *
 * The window.__socialchatPasskeyBridge flag is set by bridge-flag.js, which the
 * manifest runs in the page's main world.
 *
 * 1. Listens for window 'message' events from the Socialchat frontend
 *    (socialchat-passkey-request) and forwards them to the background script.
 * 2. Returns the result (or error) back to the page via window.postMessage.
 */

// --- Listen for passkey requests from the page ---
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.type !== 'socialchat-passkey-request') return

  const { requestId, publicKeyJson } = event.data

  chrome.runtime.sendMessage(
    { type: 'passkey-request', publicKeyJson },
    (response) => {
      const lastError = chrome.runtime.lastError
      window.postMessage({
        type: 'socialchat-passkey-response',
        requestId,
        success: !lastError && response?.data != null,
        data: response?.data || null,
        error: lastError?.message || response?.error || null
      }, '*')
    }
  )
})
