"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"
import { useNav } from "./nav"
import { useUiStore } from "@/lib/ui-store"
import { SHORTCUTS, type ShortcutAction } from "./shortcuts"

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
 * Central keyboard-shortcut handler.
 *
 *  - In the browser (web preview) it listens to `keydown` on window.
 *  - In the Electron desktop app, the menu bar registers accelerators which
 *    Electron intercepts and forwards here via IPC — so we listen to the
 *    bridge instead and skip `keydown` to avoid double-firing.
 */
export function useKeyboardShortcuts() {
  const { setView } = useNav()
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const requestAction = useUiStore((s) => s.requestAction)
  const { setTheme, resolvedTheme } = useTheme()
  const { toast } = useToast()

  const runAction = React.useCallback(
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
        case "export-pdf":
          setView("reports")
          requestAction("export-pdf")
          break
      }
    },
    [setView, setPaletteOpen, setHelpOpen, requestAction, setTheme, resolvedTheme]
  )

  // Keyboard listener (browser / web preview). Skipped on desktop where the
  // Electron menu handles accelerators and forwards via IPC.
  React.useEffect(() => {
    if (getBridge()?.isDesktop) return

    function onKeyDown(e: KeyboardEvent) {
      // When the palette or help overlay is open, let them own the keyboard
      // (they handle Esc / arrows / Enter themselves).
      const ui = useUiStore.getState()
      if (ui.paletteOpen || ui.helpOpen) return

      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      const key = e.key.toLowerCase()
      const match = SHORTCUTS.find(
        (s) =>
          s.ctrl === ctrl &&
          s.key === key &&
          !!s.shift === e.shiftKey &&
          !!s.alt === e.altKey
      )
      if (!match) return

      // Allow the palette combo even while typing in an input; everything else
      // is ignored when the user is typing so we don't hijack form entry.
      const target = e.target as HTMLElement | null
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
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
    const off = bridge.onShortcut((action) => runAction(action))
    return off
  }, [runAction])

  // Keep `toast` referenced for future feedback without changing behaviour.
  void toast
}
