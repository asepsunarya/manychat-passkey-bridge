/**
 * background.js — service worker
 *
 * Receives passkey-request from content script, finds the
 * web.whatsapp.com tab, injects navigator.credentials.get()
 * into that tab's main world, and returns the result.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'passkey-request') {
    handlePasskeyRequest(message.publicKeyJson, sender)
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message }))
    return true // keep message channel open for async response
  }

  if (message.type === 'check-wa-tab') {
    checkWhatsAppTab()
      .then((found) => sendResponse({ found }))
      .catch(() => sendResponse({ found: false }))
    return true
  }
})

/**
 * Find any open web.whatsapp.com tab.
 */
async function checkWhatsAppTab () {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
  return tabs.length > 0
}

/**
 * Core: execute navigator.credentials.get() in the web.whatsapp.com tab.
 */
async function handlePasskeyRequest (publicKeyJson, sender) {
  // Find web.whatsapp.com tab
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
  if (tabs.length === 0) {
    throw new Error(
      'Tab web.whatsapp.com tidak ditemukan. Buka https://web.whatsapp.com dan login terlebih dahulu.'
    )
  }

  // Prefer the most recently active tab
  const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0]

  // Check if the tab is actually loaded (not a login/redirect page)
  if (!tab.url || !tab.url.startsWith('https://web.whatsapp.com')) {
    throw new Error('Tab web.whatsapp.com ditemukan tetapi belum selesai dimuat. Tunggu hingga WhatsApp Web terbuka.')
  }

  // Inject the passkey request into the tab's main world
  let results
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: getPasskeyCredential,
      args: [publicKeyJson]
    })
  } catch (err) {
    throw new Error(`Gagal menginject script ke tab web.whatsapp.com: ${err.message}`)
  }

  if (results && results[0] && results[0].result !== undefined && results[0].result !== null) {
    return results[0].result
  }

  // If result is null, the user may have cancelled the passkey prompt
  if (results && results[0] && results[0].result === null) {
    throw new Error('User membatalkan prompt passkey di web.whatsapp.com.')
  }

  throw new Error('Tidak ada respons passkey dari web.whatsapp.com.')
}

/**
 * This function runs in the MAIN world of the web.whatsapp.com tab.
 * It calls navigator.credentials.get() with the provided options and
 * serializes the result to a plain JSON-compatible object.
 */
async function getPasskeyCredential (publicKeyJson) {
  const opts = PublicKeyCredential.parseRequestOptionsFromJSON(JSON.parse(publicKeyJson))
  const cred = await navigator.credentials.get({ publicKey: opts })
  if (!cred) return null

  const response = cred.response

  // Convert ArrayBuffer to base64url string
  function bufferToBase64url (buffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle
        ? bufferToBase64url(response.userHandle)
        : null
    }
  }
}
