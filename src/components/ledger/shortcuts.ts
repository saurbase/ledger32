"use client"

import {
  LayoutDashboard,
  BookText,
  ScrollText,
  FileBarChart,
  Settings as SettingsIcon,
  Plus,
  Command,
  Moon,
  FileDown,
  Keyboard,
} from "lucide-react"
import type { ViewId } from "./nav"

export type ShortcutAction =
  | { type: "navigate"; view: ViewId }
  | { type: "palette" }
  | { type: "help" }
  | { type: "theme" }
  | { type: "new-entry" }
  | { type: "new-account" }
  | { type: "export-pdf" }

export interface ShortcutDef {
  id: string
  label: string
  description: string
  /** Lowercase key name, e.g. "1", "k", "/" */
  key: string
  /** Requires Ctrl (Win/Linux) or Cmd (Mac) */
  ctrl: boolean
  shift?: boolean
  alt?: boolean
  icon: React.ComponentType<{ className?: string }>
  group: "Navigation" | "Create" | "View" | "Help"
  action: ShortcutAction
}

/** The canonical list of keyboard shortcuts. Shared by the hook, the command
 *  palette, the help overlay, and the Electron menu bar. */
export const SHORTCUTS: ShortcutDef[] = [
  {
    id: "go-dashboard",
    label: "Dashboard",
    description: "Go to the dashboard",
    key: "1",
    ctrl: true,
    icon: LayoutDashboard,
    group: "Navigation",
    action: { type: "navigate", view: "dashboard" },
  },
  {
    id: "go-accounts",
    label: "Chart of Accounts",
    description: "Go to the chart of accounts",
    key: "2",
    ctrl: true,
    icon: BookText,
    group: "Navigation",
    action: { type: "navigate", view: "accounts" },
  },
  {
    id: "go-journal",
    label: "Journal Entries",
    description: "Go to the journal",
    key: "3",
    ctrl: true,
    icon: ScrollText,
    group: "Navigation",
    action: { type: "navigate", view: "journal" },
  },
  {
    id: "go-reports",
    label: "Reports",
    description: "Go to accounting reports",
    key: "4",
    ctrl: true,
    icon: FileBarChart,
    group: "Navigation",
    action: { type: "navigate", view: "reports" },
  },
  {
    id: "go-settings",
    label: "Settings",
    description: "Go to settings",
    key: "5",
    ctrl: true,
    icon: SettingsIcon,
    group: "Navigation",
    action: { type: "navigate", view: "settings" },
  },
  {
    id: "palette",
    label: "Command Palette",
    description: "Open the command palette to run any command",
    key: "k",
    ctrl: true,
    icon: Command,
    group: "Help",
    action: { type: "palette" },
  },
  {
    id: "new-entry",
    label: "New Journal Entry",
    description: "Create a new balanced double-entry",
    key: "n",
    ctrl: true,
    icon: Plus,
    group: "Create",
    action: { type: "new-entry" },
  },
  {
    id: "new-account",
    label: "New Account",
    description: "Add an account to the chart of accounts",
    key: "b",
    ctrl: true,
    icon: Plus,
    group: "Create",
    action: { type: "new-account" },
  },
  {
    id: "export-pdf",
    label: "Export Report to PDF",
    description: "Export the current report as a PDF file",
    key: "e",
    ctrl: true,
    icon: FileDown,
    group: "Create",
    action: { type: "export-pdf" },
  },
  {
    id: "theme",
    label: "Toggle Theme",
    description: "Switch between light and dark mode",
    key: "j",
    ctrl: true,
    icon: Moon,
    group: "View",
    action: { type: "theme" },
  },
  {
    id: "help",
    label: "Keyboard Shortcuts",
    description: "Show all keyboard shortcuts",
    key: "/",
    ctrl: true,
    icon: Keyboard,
    group: "Help",
    action: { type: "help" },
  },
]

/** Whether the current platform uses the Cmd key (⌘) convention. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/** Human-readable combo, e.g. "⌘1" on Mac, "Ctrl+1" elsewhere. */
export function formatKeys(s: ShortcutDef): string {
  const mac = isMac()
  const parts: string[] = []
  if (s.ctrl) parts.push(mac ? "⌘" : "Ctrl")
  if (s.shift) parts.push(mac ? "⇧" : "Shift")
  if (s.alt) parts.push(mac ? "⌥" : "Alt")
  // Single letters are uppercased for readability; symbols like "/" stay as-is.
  parts.push(s.key.length === 1 && /[a-z]/.test(s.key) ? s.key.toUpperCase() : s.key)
  return parts.join(mac ? "" : "+")
}

/** The accelerator string Electron expects, e.g. "CmdOrCtrl+1". */
export function electronAccelerator(s: ShortcutDef): string {
  const parts: string[] = ["CmdOrCtrl"]
  if (s.shift) parts.push("Shift")
  if (s.alt) parts.push("Alt")
  parts.push(s.key.length === 1 && /[a-z]/.test(s.key) ? s.key.toUpperCase() : s.key)
  return parts.join("+")
}

/** Shortcut defs that should appear as menu items with accelerators in the
 *  desktop app. (Excludes "help" because it has its own menu entry.) */
export const MENU_SHORTCUTS: ShortcutDef[] = SHORTCUTS

export type { ViewId }
