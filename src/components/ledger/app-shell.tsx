"use client"

import * as React from "react"
import {
  LayoutDashboard,
  BookText,
  ScrollText,
  FileBarChart,
  Settings as SettingsIcon,
  Menu,
  Database,
  HardDrive,
  Server,
  Command,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/ledger/brand"
import { ThemeToggle } from "@/components/ledger/theme-toggle"
import { NavProvider, useNav, type ViewId } from "@/components/ledger/nav"
import { useStatus } from "@/hooks/use-ledger"
import { useUiStore } from "@/lib/ui-store"
import { useKeyboardShortcuts } from "@/components/ledger/use-shortcuts"
import { CommandPalette } from "@/components/ledger/command-palette"
import { ShortcutsHelp } from "@/components/ledger/shortcuts-help"
import { formatKeys, isMac } from "@/components/ledger/shortcuts"
import { DashboardView } from "@/components/ledger/views/dashboard-view"
import { ChartOfAccountsView } from "@/components/ledger/views/chart-of-accounts-view"
import { JournalView } from "@/components/ledger/views/journal-view"
import { ReportsView } from "@/components/ledger/views/reports-view"
import { SettingsView } from "@/components/ledger/views/settings-view"

const NAV_ITEMS: {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Shortcut key number shown as a kbd hint (e.g. "1" → Ctrl+1). */
  hint?: string
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "1" },
  { id: "accounts", label: "Chart of Accounts", icon: BookText, hint: "2" },
  { id: "journal", label: "Journal Entries", icon: ScrollText, hint: "3" },
  { id: "reports", label: "Reports", icon: FileBarChart, hint: "4" },
  { id: "settings", label: "Settings", icon: SettingsIcon, hint: "5" },
]

const TITLES: Record<ViewId, string> = {
  dashboard: "Dashboard",
  accounts: "Chart of Accounts",
  journal: "Journal Entries",
  reports: "Accounting Reports",
  settings: "Settings",
}

export function AppShell() {
  const [view, setView] = React.useState<ViewId>("dashboard")
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const nav = React.useMemo(() => ({ view, setView }), [view])

  return (
    <NavProvider value={nav}>
      <AppShellInner
        view={view}
        setView={setView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
    </NavProvider>
  )
}

function AppShellInner({
  view,
  setView,
  mobileOpen,
  setMobileOpen,
}: {
  view: ViewId
  setView: (v: ViewId) => void
  mobileOpen: boolean
  setMobileOpen: (o: boolean) => void
}) {
  // Register all global keyboard shortcuts (web + desktop). Must be inside
  // NavProvider so useNav() resolves.
  useKeyboardShortcuts()

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
            <SidebarContent
              view={view}
              onNavigate={(v) => {
                setView(v)
              }}
            />
          </aside>

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent
                view={view}
                onNavigate={(v) => {
                  setView(v)
                  setMobileOpen(false)
                }}
              />
            </SheetContent>
          </Sheet>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <h1 className="text-base font-semibold tracking-tight md:text-lg">
                {TITLES[view]}
              </h1>
              <div className="ml-auto flex items-center gap-2">
                <PaletteButton />
                <DataSourceBadge />
                <ThemeToggle />
              </div>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
              <ViewRouter view={view} />
            </main>

            <footer className="mt-auto border-t bg-background">
              <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row md:px-6">
                <p className="flex items-center gap-2">
                  <BrandMark className="size-4" />
                  <span>
                    <span className="font-semibold text-foreground">Ledger</span>{" "}
                    — double-entry bookkeeping
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <span>
                    Press <KbdHint>Ctrl</KbdHint>+<KbdHint>K</KbdHint> for
                    commands
                  </span>
                  <span aria-hidden>·</span>
                  <span>Built with Next.js, Electron &amp; shadcn/ui</span>
                </p>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <CommandPalette />
      <ShortcutsHelp />
    </>
  )
}

function SidebarContent({
  view,
  onNavigate,
}: {
  view: ViewId
  onNavigate: (v: ViewId) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <BrandMark className="size-8" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">Ledger</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Bookkeeping
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.hint && (
                <kbd
                  className={cn(
                    "hidden h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] font-medium lg:inline-flex",
                    active
                      ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80"
                      : "border-border bg-background/60 text-muted-foreground opacity-0 group-hover:opacity-100"
                  )}
                >
                  {item.hint}
                </kbd>
              )}
            </button>
          )
        })}
      </nav>

      <div className="space-y-2 border-t p-3">
        <PaletteButton variant="sidebar" />
        <DataSourceBadge variant="full" />
      </div>
    </div>
  )
}

/** Command palette trigger button. Shown in the header (compact) and sidebar
 *  (full-width with hint). */
function PaletteButton({
  variant = "compact",
}: {
  variant?: "compact" | "sidebar"
}) {
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const mod = isMac() ? "⌘" : "Ctrl"

  if (variant === "sidebar") {
    return (
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Command className="size-4" />
        <span className="flex-1 text-left">Search commands…</span>
        <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          {mod}+K
        </kbd>
      </button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPaletteOpen(true)}
      className="hidden h-9 gap-2 text-muted-foreground md:inline-flex"
      aria-label="Open command palette"
    >
      <Command className="size-4" />
      <span className="hidden lg:inline">Commands</span>
      <kbd className="hidden h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:inline-flex">
        {mod}+K
      </kbd>
    </Button>
  )
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  )
}

function DataSourceBadge({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const { data } = useStatus()
  const { setView } = useNav()
  const backend = data?.backend ?? "local"
  const { Icon, label, detail } = {
    local: {
      Icon: HardDrive,
      label: "Local store",
      detail: "Connect a database in Settings",
    },
    supabase: {
      Icon: Database,
      label: "Supabase",
      detail: "Connected to your Supabase project",
    },
    postgres: {
      Icon: Server,
      label: "PostgreSQL",
      detail: "Connected to your PostgreSQL database",
    },
  }[backend]

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => setView("settings")}
        className="flex w-full items-start gap-2 rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
      >
        <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="font-medium text-foreground">{label}</div>
          <div className="text-muted-foreground">{detail}</div>
        </div>
      </button>
    )
  }

  return (
    <Badge variant="outline" className="hidden gap-1.5 sm:flex">
      <Icon className="size-3 text-primary" />
      {label}
    </Badge>
  )
}

function ViewRouter({ view }: { view: ViewId }) {
  switch (view) {
    case "dashboard":
      return <DashboardView />
    case "accounts":
      return <ChartOfAccountsView />
    case "journal":
      return <JournalView />
    case "reports":
      return <ReportsView />
    case "settings":
      return <SettingsView />
    default:
      return <DashboardView />
  }
}

// keep useNav + formatKeys imports referenced for potential future use
void useNav
void formatKeys
