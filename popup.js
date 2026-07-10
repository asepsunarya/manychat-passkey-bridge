/**
 * popup.js — popup UI logic
 */

async function checkWhatsAppTab () {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'check-wa-tab' }, (response) => {
      const lastError = chrome.runtime.lastError
      resolve(lastError ? false : response?.found)
    })
  })
}

async function updateStatus () {
  const el = document.getElementById('wa-status')
  const found = await checkWhatsAppTab()

  if (found) {
    el.innerHTML = '<span class="dot ok"></span><span>Terhubung</span>'
  } else {
    el.innerHTML = '<span class="dot err"></span><span>Belum dibuka</span>'
  }
}

document.getElementById('refresh-btn').addEventListener('click', updateStatus)

updateStatus()
