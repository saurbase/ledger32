"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useNav } from "./nav"
import { useUiStore } from "@/lib/ui-store"
import { SHORTCUTS, matchesCombo, type ShortcutAction } from "./shortcuts"

/** Desktop bridge exposed by the Electron preload script. */
interface DesktopBridge {
  isDesktop: boolean
  onShortcut?: (cb: (action: ShortcutAction) => void) => () => void
}

function getBridge(): DesktopBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { ledgerDesktop?: DesktopBridge }).ledgerDesktop
}

/**
 * Returns a function that performs a shortcut action. Shared by the keyboard
 * handler, the desktop menu bridge and the command palette.
 *
 * Actions that need a specific page navigate there and leave a "pending
 * action" in the UI store, which that page consumes once its data is loaded.
 */
export function useShortcutRunner() {
  const { view, setView } = useNav()
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const requestAction = useUiStore((s) => s.requestAction)
  const { setTheme, resolvedTheme } = useTheme()

  return React.useCallback(
    (action: ShortcutAction) => {
      switch (action.type) {
        case "navigate":
          setView(action.view)
          break
        case "palette":
          setPaletteOpen(true)
          break
        case "help":
          setHelpOpen(true)
          break
        case "theme":
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
          break
        case "new-entry":
          setView("journal")
          requestAction("new-entry")
          break
        case "new-account":
          setView("accounts")
          requestAction("new-account")
          break
        case "report":
          setView("reports")
          requestAction(`report:${action.report}`)
          break
        case "export-pdf":
          // On the chart of accounts, export that; otherwise the open report.
          if (view === "accounts") {
            requestAction("export-accounts-pdf")
          } else {
            setView("reports")
            requestAction("export-pdf")
          }
          break
        case "export-csv":
          setView("accounts")
          requestAction("export-accounts-csv")
          break
      }
    },
    [view, setView, setPaletteOpen, setHelpOpen, requestAction, setTheme, resolvedTheme]
  )
}

/**
 * Central keyboard-shortcut handler.
 *
 *  - In the browser it listens to `keydown` on window.
 *  - In the Electron desktop app the menu bar registers the primary
 *    accelerators and forwards them here via IPC, so `keydown` only handles
 *    the alternate combos (which aren't in the menu) to avoid double-firing.
 */
export function useKeyboardShortcuts() {
  const runAction = useShortcutRunner()

  React.useEffect(() => {
    const desktop = !!getBridge()?.isDesktop

    function onKeyDown(e: KeyboardEvent) {
      // When the palette or help overlay is open, let them own the keyboard
      // (they handle Esc / arrows / Enter themselves).
      const ui = useUiStore.getState()
      if (ui.paletteOpen || ui.helpOpen) return
      if (!(e.ctrlKey || e.metaKey || e.altKey)) return

      const match = SHORTCUTS.find(
        (s) =>
          (!desktop && matchesCombo(e, s)) ||
          (s.alternate && matchesCombo(e, s.alternate))
      )
      if (!match) return

      // Allow the palette combo even while typing in an input; everything else
      // is ignored when the user is typing so we don't hijack form entry.
      const target = e.target as HTMLElement | null
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      if (isTyping && match.action.type !== "palette") return

      e.preventDefault()
      e.stopPropagation()
      runAction(match.action)
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [runAction])

  // Desktop IPC listener — menu accelerators forward actions here.
  React.useEffect(() => {
    const bridge = getBridge()
    if (!bridge?.onShortcut) return
    return bridge.onShortcut((action) => runAction(action))
  }, [runAction])
}
