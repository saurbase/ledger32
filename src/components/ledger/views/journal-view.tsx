"use client"

import * as React from "react"
import {
  ChevronDown,
  Eye,
  Plus,
  RotateCcw,
  ScrollText,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  useAccounts,
  useCreateJournal,
  useDeleteJournal,
  useJournal,
  useReverseJournal,
} from "@/hooks/use-ledger"
import {
  formatMoney,
  NewJournalEntry,
  round2,
  todayISO,
} from "@/lib/types"
import { ConfirmDialog } from "@/components/ledger/confirm-dialog"
import {
  ADD_JOURNAL_LINE,
  formatCombo,
  matchesCombo,
} from "@/components/ledger/shortcuts"
import { useUiStore } from "@/lib/ui-store"
import { EmptyState, LoadingBlock, PageHeader } from "./shared"

interface LineForm {
  key: string
  accountId: string
  debit: string
  credit: string
  description: string
}

function newLine(): LineForm {
  return {
    key: Math.random().toString(36).slice(2),
    accountId: "",
    debit: "",
    credit: "",
    description: "",
  }
}

export function JournalView() {
  const accounts = useAccounts()
  const journal = useJournal()
  const createMut = useCreateJournal()
  const deleteMut = useDeleteJournal()
  const reverseMut = useReverseJournal()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [reverseId, setReverseId] = React.useState<string | null>(null)

  const accountOptions = accounts.data ?? []
  const pendingAction = useUiStore((s) => s.pendingAction)
  const consumeAction = useUiStore((s) => s.consumeAction)

  // Open the New Entry dialog when a global shortcut (Ctrl+N) requests it.
  React.useEffect(() => {
    if (pendingAction !== "new-entry" || !accounts.data) return
    consumeAction()
    if (accountOptions.length >= 2) {
      setFormOpen(true)
    } else {
      toast({
        title: "Add accounts first",
        description:
          "A journal entry needs at least two accounts. Press Ctrl+B to add one.",
      })
    }
  }, [pendingAction, accounts.data, accountOptions.length, consumeAction, toast])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (accounts.isLoading || journal.isLoading) {
    return (
      <div>
        <PageHeader title="Journal Entries" />
        <LoadingBlock />
      </div>
    )
  }

  const entries = journal.data ?? []

  async function onConfirmDelete() {
    if (!deleteId) return
    try {
      await deleteMut.mutateAsync(deleteId)
      toast({ title: "Entry deleted" })
      setDeleteId(null)
    } catch (err) {
      toast({
        title: "Could not delete entry",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function onConfirmReverse() {
    if (!reverseId) return
    try {
      await reverseMut.mutateAsync(reverseId)
      toast({ title: "Entry reversed", description: "A reversing entry was created." })
      setReverseId(null)
    } catch (err) {
      toast({
        title: "Could not reverse entry",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="Every transaction is a balanced double-entry — debits must equal credits."
        actions={
          <Button
            onClick={() => setFormOpen(true)}
            disabled={accountOptions.length < 2}
          >
            <Plus className="size-4" /> New entry
          </Button>
        }
      />

      {accountOptions.length < 2 ? (
        <EmptyState
          icon={ScrollText}
          title="You need at least two accounts"
          description="Create accounts in the Chart of Accounts before posting journal entries."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No journal entries yet"
          description="Record your first double-entry transaction. Each entry needs at least two lines that balance."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" /> New entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const totalDebit = round2(
              e.lines.reduce((s, l) => s + (l.debit || 0), 0)
            )
            const isOpen = expanded.has(e.id)
            return (
              <Card key={e.id}>
                <CardContent className="p-0">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left md:px-6"
                    onClick={() => toggleExpanded(e.id)}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {e.description}
                        </span>
                        {e.isReversal && (
                          <Badge variant="secondary">Reversal</Badge>
                        )}
                        {e.isReversed && (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 text-destructive"
                          >
                            Reversed
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-mono">{e.date}</span>
                        {e.reference && <span>· {e.reference}</span>}
                        <span>· {e.lines.length} lines</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tnum">
                        {formatMoney(totalDebit)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Total
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/30">
                      <div className="overflow-x-auto scroll-thin">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                              <th className="w-20 px-4 py-2 font-medium md:px-6">
                                Code
                              </th>
                              <th className="px-4 py-2 font-medium md:px-6">
                                Account
                              </th>
                              <th className="hidden px-4 py-2 font-medium md:table-cell md:px-6">
                                Memo
                              </th>
                              <th className="w-28 px-4 py-2 text-right font-medium md:px-6">
                                Debit
                              </th>
                              <th className="w-28 px-4 py-2 text-right font-medium md:px-6">
                                Credit
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {e.lines.map((l) => {
                              const acc = accountOptions.find(
                                (a) => a.id === l.accountId
                              )
                              return (
                                <tr key={l.id} className="border-b last:border-0">
                                  <td className="px-4 py-2 font-mono text-xs md:px-6">
                                    {acc?.code ?? "—"}
                                  </td>
                                  <td className="px-4 py-2 font-medium md:px-6">
                                    {acc?.name ?? "Unknown account"}
                                  </td>
                                  <td className="hidden px-4 py-2 text-muted-foreground md:table-cell md:px-6">
                                    {l.description || "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right tnum md:px-6">
                                    {l.debit ? formatMoney(l.debit) : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right tnum md:px-6">
                                    {l.credit ? formatMoney(l.credit) : "—"}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t font-medium">
                              <td
                                colSpan={3}
                                className="px-4 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground md:px-6"
                              >
                                Totals
                              </td>
                              <td className="px-4 py-2 text-right tnum md:px-6">
                                {formatMoney(
                                  round2(
                                    e.lines.reduce((s, l) => s + (l.debit || 0), 0)
                                  )
                                )}
                              </td>
                              <td className="px-4 py-2 text-right tnum md:px-6">
                                {formatMoney(
                                  round2(
                                    e.lines.reduce((s, l) => s + (l.credit || 0), 0)
                                  )
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 md:px-6">
                        {!e.isReversal && !e.isReversed && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReverseId(e.id)}
                          >
                            <RotateCcw className="size-4" /> Reverse
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(e.id)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <NewEntryDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        accounts={accountOptions}
        submitting={createMut.isPending}
        onSubmit={async (payload) => {
          try {
            await createMut.mutateAsync(payload)
            toast({ title: "Journal entry posted" })
            setFormOpen(false)
          } catch (err) {
            toast({
              title: "Could not post entry",
              description: err instanceof Error ? err.message : undefined,
              variant: "destructive",
            })
          }
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this journal entry?"
        description="The entry and all of its lines will be permanently removed. If this entry has been reversed, the reversing entry will also be deleted. Use Reverse instead if you want to keep an audit trail."
        confirmLabel="Delete entry"
        destructive
        loading={deleteMut.isPending}
        onConfirm={onConfirmDelete}
      />

      <ConfirmDialog
        open={reverseId !== null}
        onOpenChange={(o) => !o && setReverseId(null)}
        title="Reverse this journal entry?"
        description="A new reversing entry will be created with the debits and credits swapped, dated the same as the original. The original entry is preserved for audit. This keeps your books balanced."
        confirmLabel="Create reversing entry"
        loading={reverseMut.isPending}
        onConfirm={onConfirmReverse}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// New entry dialog with dynamic, balanced line editor
// ---------------------------------------------------------------------------

function NewEntryDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  accounts: { id: string; code: string; name: string; type: string }[]
  onSubmit: (payload: NewJournalEntry) => Promise<void>
  submitting: boolean
}) {
  const [date, setDate] = React.useState(todayISO())
  const [description, setDescription] = React.useState("")
  const [reference, setReference] = React.useState("")
  const [lines, setLines] = React.useState<LineForm[]>([newLine(), newLine()])
  const [error, setError] = React.useState<string | null>(null)

  // Reset the form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setDate(todayISO())
      setDescription("")
      setReference("")
      setLines([newLine(), newLine()])
      setError(null)
    }
  }, [open])

  const totals = React.useMemo(() => {
    let d = 0
    let c = 0
    for (const l of lines) {
      d += Number(l.debit || 0)
      c += Number(l.credit || 0)
    }
    return { debit: round2(d), credit: round2(c), diff: round2(d - c) }
  }, [lines])

  function updateLine(key: string, patch: Partial<LineForm>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  function setDebit(key: string, value: string) {
    // Typing a debit clears the credit (bookkeeping UX).
    updateLine(key, value ? { debit: value, credit: "" } : { debit: value })
  }

  function setCredit(key: string, value: string) {
    updateLine(key, value ? { credit: value, debit: "" } : { credit: value })
  }

  const formRef = React.useRef<HTMLFormElement>(null)
  const [focusLineKey, setFocusLineKey] = React.useState<string | null>(null)

  function addLine() {
    const line = newLine()
    setLines((prev) => [...prev, line])
    setFocusLineKey(line.key)
  }

  // Move focus to the new line's account picker so entry can continue from
  // the keyboard.
  React.useEffect(() => {
    if (!focusLineKey) return
    const el = formRef.current?.querySelector<HTMLElement>(
      `[data-line-key="${focusLineKey}"]`
    )
    el?.focus()
    el?.scrollIntoView({ block: "nearest" })
    setFocusLineKey(null)
  }, [focusLineKey, lines])

  // Alt+L adds a line, even while typing in one of the form's fields.
  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (matchesCombo(e.nativeEvent, ADD_JOURNAL_LINE)) {
      e.preventDefault()
      addLine()
    }
  }

  function removeLine(key: string) {
    setLines((prev) =>
      prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!date) return setError("Date is required.")
    if (!description.trim()) return setError("Description is required.")

    const cleanLines = lines
      .filter((l) => l.accountId)
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description.trim() || null,
      }))

    if (cleanLines.length < 2)
      return setError("At least two lines with accounts are required.")

    for (const l of cleanLines) {
      if (l.debit < 0 || l.credit < 0)
        return setError("Amounts must be positive.")
      if (l.debit > 0 && l.credit > 0)
        return setError("A line cannot have both a debit and a credit.")
      if (l.debit === 0 && l.credit === 0)
        return setError("Each line needs a non-zero debit or credit.")
    }

    const tDebit = round2(cleanLines.reduce((s, l) => s + l.debit, 0))
    const tCredit = round2(cleanLines.reduce((s, l) => s + l.credit, 0))
    if (tDebit !== tCredit)
      return setError(
        `Entry is not balanced. Debits ${tDebit.toFixed(2)} ≠ Credits ${tCredit.toFixed(2)}.`
      )

    await onSubmit({
      date,
      description: description.trim(),
      reference: reference.trim() || null,
      lines: cleanLines,
    })
  }

  const balanced = totals.diff === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={onFormKeyDown}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>New journal entry</DialogTitle>
            <DialogDescription>
              Record a balanced transaction. Debits must equal credits.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="je-date">Date</Label>
              <Input
                id="je-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="je-desc">Description</Label>
              <Input
                id="je-desc"
                placeholder="e.g. Cash sale to customer"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="je-ref">Reference (optional)</Label>
              <Input
                id="je-ref"
                placeholder="e.g. INV-1042"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lines</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                title={`Add line (${formatCombo(ADD_JOURNAL_LINE)})`}
              >
                <Plus className="size-4" /> Add line
                <kbd className="ml-1 hidden rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground sm:inline">
                  {formatCombo(ADD_JOURNAL_LINE)}
                </kbd>
              </Button>
            </div>

            <div className="max-h-[40vh] space-y-2 overflow-y-auto scroll-thin pr-1">
              {lines.map((l, idx) => (
                <div
                  key={l.key}
                  className="grid grid-cols-12 items-end gap-2 rounded-md border p-2"
                >
                  <div className="col-span-12 space-y-1 sm:col-span-5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Account #{idx + 1}
                    </Label>
                    <Select
                      value={l.accountId}
                      onValueChange={(v) =>
                        updateLine(l.key, { accountId: v })
                      }
                    >
                      <SelectTrigger className="w-full" data-line-key={l.key}>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="font-mono text-xs">{a.code}</span>{" "}
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5 space-y-1 sm:col-span-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Debit
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={l.debit}
                      onChange={(e) => setDebit(l.key, e.target.value)}
                      className="text-right tnum"
                    />
                  </div>
                  <div className="col-span-5 space-y-1 sm:col-span-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Credit
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={l.credit}
                      onChange={(e) => setCredit(l.key, e.target.value)}
                      className="text-right tnum"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(l.key)}
                      disabled={lines.length <= 2}
                      aria-label="Remove line"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="flex gap-4 tnum">
                <span>
                  <span className="text-muted-foreground">Debits: </span>
                  <span className="font-semibold">{formatMoney(totals.debit)}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Credits: </span>
                  <span className="font-semibold">{formatMoney(totals.credit)}</span>
                </span>
              </div>
              <Badge
                variant={balanced ? "secondary" : "destructive"}
                className={cn(balanced && "border-emerald-500/40 text-emerald-600 dark:text-emerald-500")}
              >
                {balanced
                  ? "Balanced"
                  : `Out of balance by ${formatMoney(Math.abs(totals.diff))}`}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Posting…" : "Post entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
