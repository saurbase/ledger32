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
import { SHORTCUTS, formatKeys } from "./shortcuts"

const GROUP_ORDER = ["Navigation", "Create", "View", "Help"]

export function ShortcutsHelp() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, [])
      map.get(s.group)!.push(s)
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Drive Ledger entirely from the keyboard. Press{" "}
            <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> anywhere to open the command palette.
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
                      <ShortcutKeys def={s} />
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutKeys({ def }: { def: (typeof SHORTCUTS)[number] }) {
  const mac = formatKeys(def).includes("⌘")
  const parts = formatKeys(def).split(mac ? "" : "+")
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
