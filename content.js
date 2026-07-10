/**
 * content.js — runs on every page (isolated world)
 *
 * 1. Injects window.__socialchatPasskeyBridge = true into the page's main world
 *    so the Socialchat frontend knows the extension is installed.
 * 2. Listens for window 'message' events from the Socialchat frontend
 *    (socialchat-passkey-request) and forwards them to the background script.
 * 3. Returns the result (or error) back to the page via window.postMessage.
 */

// --- Inject bridge flag into main world ---
const flagScript = document.createElement('script')
flagScript.textContent = 'window.__socialchatPasskeyBridge = true;'
;(document.head || document.documentElement).appendChild(flagScript)
flagScript.remove()

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
