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
  FileSpreadsheet,
  Keyboard,
  ListOrdered,
  BookOpen,
  TrendingUp,
  Scale,
} from "lucide-react"
import type { ViewId } from "./nav"

export type ReportId =
  | "trial-balance"
  | "general-ledger"
  | "income-statement"
  | "balance-sheet"

export type ShortcutAction =
  | { type: "navigate"; view: ViewId }
  | { type: "palette" }
  | { type: "help" }
  | { type: "theme" }
  | { type: "new-entry" }
  | { type: "new-account" }
  | { type: "report"; report: ReportId }
  /** Export the current page as PDF: the open report, or the chart of accounts. */
  | { type: "export-pdf" }
  /** Export the chart of accounts as CSV. */
  | { type: "export-csv" }

/** A key combination. Ctrl means Cmd (⌘) on macOS. */
export interface KeyCombo {
  /** Lowercase key name, e.g. "1", "k", "/" */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export interface ShortcutDef extends KeyCombo {
  id: string
  label: string
  description: string
  /**
   * A second combination that also triggers the action, used where the
   * primary one is reserved by browsers (e.g. Ctrl+N opens a new window in
   * Chrome, so a page can never receive it).
   */
  alternate?: KeyCombo
  icon: React.ComponentType<{ className?: string }>
  group: "Navigation" | "Create" | "Reports" | "Export" | "View" | "Help"
  action: ShortcutAction
}

export const GROUP_ORDER: ShortcutDef["group"][] = [
  "Create",
  "Reports",
  "Export",
  "Navigation",
  "View",
  "Help",
]

/** The canonical list of keyboard shortcuts. Shared by the keyboard hook, the
 *  command palette and the help overlay. Keep electron/main.cjs's menu in sync. */
export const SHORTCUTS: ShortcutDef[] = [
  // ---- Create ----
  {
    id: "new-entry",
    label: "New Journal Entry",
    description: "Create a new balanced double-entry",
    key: "n",
    ctrl: true,
    alternate: { key: "n", alt: true },
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

  // ---- Reports ----
  {
    id: "report-trial-balance",
    label: "Trial Balance",
    description: "Generate the trial balance",
    key: "1",
    alt: true,
    icon: ListOrdered,
    group: "Reports",
    action: { type: "report", report: "trial-balance" },
  },
  {
    id: "report-general-ledger",
    label: "General Ledger",
    description: "Generate the general ledger",
    key: "2",
    alt: true,
    icon: BookOpen,
    group: "Reports",
    action: { type: "report", report: "general-ledger" },
  },
  {
    id: "report-income-statement",
    label: "Income Statement",
    description: "Generate the income statement (profit & loss)",
    key: "3",
    alt: true,
    icon: TrendingUp,
    group: "Reports",
    action: { type: "report", report: "income-statement" },
  },
  {
    id: "report-balance-sheet",
    label: "Balance Sheet",
    description: "Generate the balance sheet",
    key: "4",
    alt: true,
    icon: Scale,
    group: "Reports",
    action: { type: "report", report: "balance-sheet" },
  },

  // ---- Export ----
  {
    id: "export-pdf",
    label: "Export to PDF",
    description:
      "Export the page you're on: the open report, the chart of accounts, or the journal",
    key: "e",
    ctrl: true,
    icon: FileDown,
    group: "Export",
    action: { type: "export-pdf" },
  },
  {
    id: "export-csv",
    label: "Export to CSV",
    description:
      "Download the journal (on the Journal page) or the chart of accounts as CSV",
    key: "e",
    ctrl: true,
    shift: true,
    icon: FileSpreadsheet,
    group: "Export",
    action: { type: "export-csv" },
  },

  // ---- Navigation ----
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

  // ---- View / Help ----
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

/**
 * Shortcuts that only apply inside a specific form or dialog. They are
 * handled by that component (so they work while typing in its fields) and
 * listed in the help overlay.
 */
export interface ContextShortcut extends KeyCombo {
  id: string
  label: string
  context: string
}

export const ADD_JOURNAL_LINE: ContextShortcut = {
  id: "journal-add-line",
  label: "Add line",
  context: "New journal entry form",
  key: "l",
  alt: true,
}

export const CONTEXT_SHORTCUTS: ContextShortcut[] = [ADD_JOURNAL_LINE]

/** Whether the current platform uses the Cmd key (⌘) convention. */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/** The individual key labels of a combo, e.g. ["Ctrl", "Shift", "E"] or ["⌘", "E"]. */
export function comboParts(c: KeyCombo): string[] {
  const mac = isMac()
  const parts: string[] = []
  if (c.ctrl) parts.push(mac ? "⌘" : "Ctrl")
  if (c.shift) parts.push(mac ? "⇧" : "Shift")
  if (c.alt) parts.push(mac ? "⌥" : "Alt")
  // Single letters are uppercased for readability; symbols like "/" stay as-is.
  parts.push(c.key.length === 1 && /[a-z]/.test(c.key) ? c.key.toUpperCase() : c.key)
  return parts
}

/** Human-readable combo, e.g. "⌘1" on Mac, "Ctrl+1" elsewhere. */
export function formatCombo(c: KeyCombo): string {
  return comboParts(c).join(isMac() ? "" : "+")
}

/** Primary combo of a shortcut, as text. */
export function formatKeys(s: ShortcutDef): string {
  return formatCombo(s)
}

/**
 * The logical key of a keyboard event. Uses `code` for letters and digits so
 * combos still match when a modifier changes the produced character (e.g.
 * Shift+1 → "!" or macOS Option+1 → "¡").
 */
function eventKey(e: KeyboardEvent): string {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code) ?? /^Key([A-Z])$/.exec(e.code)
  return m ? m[1].toLowerCase() : e.key.toLowerCase()
}

export function matchesCombo(e: KeyboardEvent, c: KeyCombo): boolean {
  return (
    eventKey(e) === c.key &&
    (e.ctrlKey || e.metaKey) === !!c.ctrl &&
    e.shiftKey === !!c.shift &&
    e.altKey === !!c.alt
  )
}

export type { ViewId }
