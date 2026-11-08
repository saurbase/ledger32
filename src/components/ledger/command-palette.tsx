"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useNav } from "./nav"
import { useUiStore } from "@/lib/ui-store"
import { SHORTCUTS, formatKeys, type ShortcutAction } from "./shortcuts"

const GROUP_ORDER: Record<string, number> = {
  Navigation: 0,
  Create: 1,
  View: 2,
  Help: 3,
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const requestAction = useUiStore((s) => s.requestAction)
  const { setView } = useNav()
  const { setTheme, resolvedTheme } = useTheme()
  const [search, setSearch] = React.useState("")

  // Reset the search field every time the palette opens.
  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  const run = React.useCallback(
    (action: ShortcutAction) => {
      setOpen(false)
      switch (action.type) {
        case "navigate":
          setView(action.view)
          break
        case "palette":
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
    [setOpen, setView, setHelpOpen, setTheme, resolvedTheme, requestAction]
  )

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, [])
      map.get(s.group)!.push(s)
    }
    return Array.from(map.entries()).sort(
      (a, b) => (GROUP_ORDER[a[0]] ?? 99) - (GROUP_ORDER[b[0]] ?? 99)
    )
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="sm:max-w-lg"
    >
      <CommandInput
        placeholder="Type a command or search…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {groups.map(([groupName, items], idx) => (
          <React.Fragment key={groupName}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={groupName}>
              {items.map((s) => {
                const Icon = s.icon
                return (
                  <CommandItem
                    key={s.id}
                    value={`${s.label} ${s.description}`}
                    onSelect={() => run(s.action)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{s.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.description}
                      </span>
                    </div>
                    <CommandShortcut>{formatKeys(s)}</CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
