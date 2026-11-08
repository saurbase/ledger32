// Ledger — Electron preload script
// Runs in an isolated context before the web page loads.
// Exposes a tiny, safe bridge so the React app can receive keyboard-shortcut
// actions forwarded from the main process (menu accelerators).

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Subscribe to shortcut actions coming from the main process.
 * @param {function} cb - called with the action payload { type, view? }
 * @returns {function} unsubscribe
 */
function onShortcut(cb) {
  const handler = (_event, action) => cb(action);
  ipcRenderer.on("shortcut", handler);
  return () => {
    ipcRenderer.removeListener("shortcut", handler);
  };
}

contextBridge.exposeInMainWorld("ledgerDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // Keyboard shortcut bridge (menu accelerators → renderer).
  onShortcut,
});

window.addEventListener("DOMContentLoaded", () => {
  document.title = "Ledger — Double-Entry Bookkeeping";
});
