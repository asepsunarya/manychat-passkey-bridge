/**
 * bridge-flag.js — runs in the page's main world (manifest "world": "MAIN")
 *
 * Sets window.__socialchatPasskeyBridge so the Socialchat frontend knows the
 * extension is installed. Declared in the manifest instead of injected as an
 * inline <script>, which the content-script CSP and strict page CSPs block.
 */
window.__socialchatPasskeyBridge = true
