"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUiStore } from "@/lib/ui-store"
import {
  CONTEXT_SHORTCUTS,
  GROUP_ORDER,
  SHORTCUTS,
  comboParts,
  type KeyCombo,
} from "./shortcuts"

export function ShortcutsHelp() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, [])
      map.get(s.group)!.push(s)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map(
      (g) => [g, map.get(g)!] as const
    )
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Drive Ledger entirely from the keyboard. Press{" "}
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> anywhere to open the command palette.
            In a web browser, use <Kbd>Alt</Kbd>+<Kbd>N</Kbd> for a new journal
            entry, because browsers keep <Kbd>Ctrl</Kbd>+<Kbd>N</Kbd> for
            opening a new window.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto scroll-thin pr-1">
          {groups.map(([groupName, items]) => (
            <div key={groupName} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {groupName}
              </h3>
              <ul className="space-y-1">
                {items.map((s) => {
                  const Icon = s.icon
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="font-medium">{s.label}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ShortcutKeys combo={s} />
                        {s.alternate && (
                          <>
                            <span className="text-xs text-muted-foreground">or</span>
                            <ShortcutKeys combo={s.alternate} />
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              In forms
            </h3>
            <ul className="space-y-1">
              {CONTEXT_SHORTCUTS.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.context}
                    </span>
                  </span>
                  <ShortcutKeys combo={s} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutKeys({ combo }: { combo: KeyCombo }) {
  const parts = comboParts(combo)
  return (
    <span className="flex items-center gap-1">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted-foreground">+</span>}
          <Kbd>{p}</Kbd>
        </React.Fragment>
      ))}
    </span>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}
