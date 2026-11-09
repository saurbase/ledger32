"use client"

import * as React from "react"
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
import { useUiStore } from "@/lib/ui-store"
import {
  GROUP_ORDER,
  SHORTCUTS,
  formatKeys,
  type ShortcutAction,
} from "./shortcuts"
import { useShortcutRunner } from "./use-shortcuts"

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const runAction = useShortcutRunner()
  const [search, setSearch] = React.useState("")

  // Reset the search field every time the palette opens.
  React.useEffect(() => {
    if (open) setSearch("")
  }, [open])

  const run = React.useCallback(
    (action: ShortcutAction) => {
      setOpen(false)
      if (action.type !== "palette") runAction(action)
    },
    [setOpen, runAction]
  )

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.group)) map.set(s.group, [])
      map.get(s.group)!.push(s)
    }
    return Array.from(map.entries()).sort(
      (a, b) =>
        GROUP_ORDER.indexOf(a[0] as (typeof GROUP_ORDER)[number]) -
        GROUP_ORDER.indexOf(b[0] as (typeof GROUP_ORDER)[number])
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
