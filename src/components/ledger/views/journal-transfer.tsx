"use client"

import * as React from "react"
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useImportJournal } from "@/hooks/use-ledger"
import {
  csvToJournal,
  downloadText,
  journalCsvTemplate,
  journalToCsv,
  type ParsedJournal,
} from "@/lib/csv"
import { exportJournal } from "@/lib/pdf"
import {
  formatMoney,
  round2,
  todayISO,
  type Account,
  type JournalEntry,
} from "@/lib/types"
import { useUiStore } from "@/lib/ui-store"

interface PendingImport extends ParsedJournal {
  fileName: string
}

/**
 * Import / Export buttons for the Journal page, the CSV import preview, and
 * the Ctrl+E / Ctrl+Shift+E export shortcuts while on this page.
 */
export function JournalTransferActions({
  accounts,
  entries,
}: {
  accounts: Account[]
  entries: JournalEntry[]
}) {
  const importMut = useImportJournal()
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pending, setPending] = React.useState<PendingImport | null>(null)
  const [skipDuplicates, setSkipDuplicates] = React.useState(true)
  const pendingAction = useUiStore((s) => s.pendingAction)
  const consumeAction = useUiStore((s) => s.consumeAction)

  const exportPdf = React.useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "No journal entries to export yet" })
      return
    }
    exportJournal(entries, accounts, todayISO())
    toast({ title: "Journal exported to PDF" })
  }, [entries, accounts, toast])

  const exportCsv = React.useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "No journal entries to export yet" })
      return
    }
    downloadText(
      `journal-${todayISO()}.csv`,
      journalToCsv(entries, accounts),
      "text/csv;charset=utf-8"
    )
    toast({ title: `Exported ${entries.length} journal entries to CSV` })
  }, [entries, accounts, toast])

  // Keyboard shortcuts while on the Journal page.
  React.useEffect(() => {
    if (pendingAction === "export-journal-pdf") {
      consumeAction()
      exportPdf()
    } else if (pendingAction === "export-journal-csv") {
      consumeAction()
      exportCsv()
    }
  }, [pendingAction, consumeAction, exportPdf, exportCsv])

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      toast({
        title: "Unsupported file",
        description: "Please choose a .csv file. PDF files can't be imported.",
        variant: "destructive",
      })
      return
    }
    const parsed = csvToJournal(await file.text())

    // Flag account codes that don't exist yet, before anything is sent.
    const codes = new Set(accounts.map((a) => a.code.toLowerCase()))
    const valid: ParsedJournal["entries"] = []
    const errors = [...parsed.errors]
    for (const entry of parsed.entries) {
      const unknown = [
        ...new Set(
          entry.lines
            .map((l) => l.accountCode)
            .filter((c) => !codes.has(c.toLowerCase()))
        ),
      ]
      if (unknown.length) {
        errors.push({
          entry: entry.label,
          error: `Unknown account code${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Add ${unknown.length > 1 ? "them" : "it"} to the chart of accounts first.`,
        })
      } else {
        valid.push(entry)
      }
    }
    setSkipDuplicates(true)
    setPending({ entries: valid, errors, fileName: file.name })
  }

  async function onConfirmImport() {
    if (!pending || pending.entries.length === 0) return
    try {
      const r = await importMut.mutateAsync({
        entries: pending.entries,
        skipDuplicates,
      })
      const parts = [
        r.created && `${r.created} imported`,
        r.skipped && `${r.skipped} skipped (already exist)`,
        r.errors.length && `${r.errors.length} failed`,
      ].filter(Boolean)
      toast({
        title: "Import finished",
        description:
          (parts.join(", ") || "Nothing to import") +
          (r.errors.length
            ? ". " +
              r.errors
                .slice(0, 3)
                .map((x) => `Entry ${x.entry}: ${x.error}`)
                .join("; ")
            : ""),
        variant: r.errors.length ? "destructive" : undefined,
      })
      setPending(null)
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  const count = pending?.entries.length ?? 0

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChosen}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Upload className="size-4" /> Import
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> Import from CSV…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              downloadText(
                "journal-template.csv",
                journalCsvTemplate(),
                "text/csv;charset=utf-8"
              )
            }
          >
            <Download className="size-4" /> Download CSV template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={entries.length === 0}>
            <Download className="size-4" /> Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={exportPdf}>
            <FileText className="size-4" /> Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportCsv}>
            <FileSpreadsheet className="size-4" /> Export as CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* CSV import preview / confirm */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import journal entries</DialogTitle>
            <DialogDescription>
              {pending?.fileName}: {count} valid entr{count === 1 ? "y" : "ies"}
              {pending?.errors.length
                ? `, ${pending.errors.length} with problems`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>

          {pending && pending.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs scroll-thin">
              <div className="mb-1 font-medium text-destructive">
                These entries will be skipped:
              </div>
              <ul className="space-y-0.5">
                {pending.errors.map((e, i) => (
                  <li key={i}>
                    {e.entry ? `Entry ${e.entry}: ` : ""}
                    {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending && count > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border scroll-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Entry</th>
                    <th className="px-3 py-1.5 font-medium">Date</th>
                    <th className="px-3 py-1.5 font-medium">Description</th>
                    <th className="px-3 py-1.5 font-medium">Ref</th>
                    <th className="px-3 py-1.5 text-right font-medium">Lines</th>
                    <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.entries.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{e.label}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono">{e.date}</td>
                      <td className="max-w-[14rem] truncate px-3 py-1.5">
                        {e.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                        {e.reference ?? ""}
                      </td>
                      <td className="px-3 py-1.5 text-right">{e.lines.length}</td>
                      <td className="px-3 py-1.5 text-right tnum">
                        {formatMoney(
                          round2(e.lines.reduce((s, l) => s + l.debit, 0))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {count > 0 && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="skip-dupes"
                checked={skipDuplicates}
                onCheckedChange={(v) => setSkipDuplicates(v === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="skip-dupes">Skip entries that already exist</Label>
                <p className="text-xs text-muted-foreground">
                  An entry with the same date, description, reference and
                  lines is treated as a duplicate, so importing the same file
                  twice won&apos;t double your books.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              onClick={onConfirmImport}
              disabled={importMut.isPending || count === 0}
            >
              <Upload className="size-4" />
              Import {count} entr{count === 1 ? "y" : "ies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
