# Manychat Passkey Bridge

Chrome extension that automates WhatsApp passkey verification for Manychat.

## Problem

WhatsApp accounts locked with passkeys require a WebAuthn assertion signed by the account owner's authenticator, bound to the origin `web.whatsapp.com`. Because the Manychat frontend runs on a different domain, the browser cannot produce a valid assertion directly — the user had to manually copy-paste code between the browser console and the Manychat dialog.

## Solution

This extension acts as a bridge:

1. **Content script** injects `window.__manychatPasskeyBridge = true` into every page, so the Manychat frontend knows the extension is available.
2. When Manychat receives a `passkey-request` from the engine (manual mode), it sends a `window.postMessage` to the extension instead of showing the manual copy-paste dialog.
3. The **background service worker** finds the open `web.whatsapp.com` tab and injects `navigator.credentials.get()` into that tab's **main world** (where the origin is correct and the authenticator can sign the assertion).
4. The result is returned to the Manychat frontend, which submits it to the engine via the existing `POST /passkey-response/:id` API.

## Installation

### Developer mode (unpacked)

1. Download or clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `manychat-passkey-bridge` folder

### Chrome Web Store

_(coming soon)_

## Usage

1. Open `https://web.whatsapp.com` in a tab and log in to the WhatsApp account
2. Open the Manychat frontend in another tab
3. Start the WhatsApp channel pairing flow as usual
4. When passkey verification is requested, the extension automatically calls `navigator.credentials.get()` in the web.whatsapp.com tab
5. The browser's native passkey prompt appears — approve it
6. The response is sent back to Manychat automatically

If the extension is not installed, Manychat falls back to the manual copy-paste dialog.

## Architecture

```
Manychat Frontend                Extension                     web.whatsapp.com
─────────────────                ─────────                     ─────────────────
                  window.postMessage
  passkey-request ─────────────►  content.js
                                   │
                                   │ chrome.runtime.sendMessage
                                   ▼
                                 background.js
                                   │
                                   │ chrome.scripting.executeScript
                                   │ (world: 'MAIN')
                                   ▼
                                 navigator.credentials.get() ──► passkey prompt
                                   │
                                   │ result (base64url JSON)
                                   ▼
                                 background.js
                                   │
                                   │ sendResponse
                                   ▼
                                 content.js
                  window.postMessage
  passkey-response ◄─────────────
                                   │
                                   ▼
                                 POST /passkey-response/:id
```

## Manychat Frontend Integration

Add this snippet to the passkey handler in `realtime.service.js`:

```javascript
// Check if extension is available
if (window.__manychatPasskeyBridge) {
  const passkeyResponse = await requestPasskeyViaExtension(publicKeyJson)
  if (passkeyResponse) {
    await submitPasskeyResponse(channelId, passkeyResponse)
    return
  }
  // If extension fails (no WA tab, user cancelled), fall through to manual dialog
}

// Existing manual dialog fallback
const passkeyResponse = await showPasskeyManualDialog({ publicKeyJson })

// Helper function:
function requestPasskeyViaExtension (publicKeyJson) {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID()
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler)
      resolve(null)
    }, 120000) // 2 min timeout

    function handler (event) {
      if (event.source !== window) return
      if (event.data?.type !== 'manychat-passkey-response') return
      if (event.data.requestId !== requestId) return
      clearTimeout(timeout)
      window.removeEventListener('message', handler)
      resolve(event.data.success ? event.data.data : null)
    }

    window.addEventListener('message', handler)
    window.postMessage({
      type: 'manychat-passkey-request',
      requestId,
      publicKeyJson
    }, '*')
  })
}
```

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions, content scripts, service worker |
| `content.js` | Content script (isolated world) — bridges page ↔ background |
| `background.js` | Service worker — finds WA tab, injects `navigator.credentials.get()` |
| `popup.html` / `popup.js` | Popup UI — shows WhatsApp Web tab status |
| `icons/` | Extension icons (16/48/128px) |

## Permissions

| Permission | Why |
|------------|-----|
| `scripting` | Inject `navigator.credentials.get()` into the web.whatsapp.com tab |
| `tabs` | Query for open web.whatsapp.com tabs |
| `storage` | Reserved for future settings |
| `host_permissions: web.whatsapp.com` | Required to inject scripts into WA tabs |

The extension does **not** read or store any WhatsApp messages, credentials, or personal data.

## License

MIT
