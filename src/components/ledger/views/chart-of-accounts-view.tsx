"use client"

import * as React from "react"
import {
  BookText,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useImportAccounts,
  useJournal,
  useUpdateAccount,
} from "@/hooks/use-ledger"
import { accountBalance } from "@/lib/reports"
import {
  accountCsvTemplate,
  accountsToCsv,
  csvToAccounts,
  downloadText,
  type ParsedAccounts,
} from "@/lib/csv"
import { exportChartOfAccounts } from "@/lib/pdf"
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AccountType,
  formatMoney,
  NewAccount,
  round2,
  todayISO,
} from "@/lib/types"
import { ConfirmDialog } from "@/components/ledger/confirm-dialog"
import { useUiStore } from "@/lib/ui-store"
import { EmptyState, LoadingBlock, PageHeader } from "./shared"

interface FormState {
  code: string
  name: string
  type: AccountType
  subtype: string
  description: string
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  type: "asset",
  subtype: "",
  description: "",
}

/** A parsed CSV waiting for the user to confirm the import. */
interface PendingImport extends ParsedAccounts {
  fileName: string
  /** How many rows match an existing account code. */
  existingCount: number
}

export function ChartOfAccountsView() {
  const accounts = useAccounts()
  const journal = useJournal()
  const createMut = useCreateAccount()
  const updateMut = useUpdateAccount()
  const deleteMut = useDeleteAccount()
  const importMut = useImportAccounts()
  const { toast } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] =
    React.useState<PendingImport | null>(null)
  const [importMode, setImportMode] = React.useState<"update" | "skip">(
    "update"
  )

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const pendingAction = useUiStore((s) => s.pendingAction)
  const consumeAction = useUiStore((s) => s.consumeAction)

  // Open the Add Account dialog when a global shortcut (Ctrl+B) requests it.
  React.useEffect(() => {
    if (pendingAction === "new-account") {
      setEditing(null)
      setForm(EMPTY_FORM)
      setOpen(true)
      consumeAction()
    }
  }, [pendingAction, consumeAction])

  const balances = React.useMemo(() => {
    const entries = journal.data ?? []
    const map = new Map<string, number>()
    for (const a of accounts.data ?? []) {
      map.set(a.id, accountBalance(a, entries).balance)
    }
    return map
  }, [accounts.data, journal.data])

  // Export shortcuts: Ctrl+E (PDF, on this page) and Ctrl+Shift+E (CSV).
  // Wait until accounts and balances have loaded so the export isn't empty.
  React.useEffect(() => {
    const pdf = pendingAction === "export-accounts-pdf"
    const csv = pendingAction === "export-accounts-csv"
    if (!pdf && !csv) return
    if (!accounts.data || (pdf && !journal.data)) return
    consumeAction()
    const list = accounts.data
    if (list.length === 0) {
      toast({ title: "No accounts to export yet" })
      return
    }
    if (pdf) {
      exportChartOfAccounts(list, balances, todayISO())
      toast({ title: "Chart of accounts exported to PDF" })
    } else {
      downloadText(
        `chart-of-accounts-${todayISO()}.csv`,
        accountsToCsv(list),
        "text/csv;charset=utf-8"
      )
      toast({ title: `Exported ${list.length} accounts to CSV` })
    }
  }, [pendingAction, accounts.data, journal.data, balances, consumeAction, toast])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(id: string) {
    const a = accounts.data?.find((x) => x.id === id)
    if (!a) return
    setEditing(id)
    setForm({
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? "",
      description: a.description ?? "",
    })
    setOpen(true)
  }

  // ---- Export ---------------------------------------------------------------

  function onExportCsv() {
    const list = accounts.data ?? []
    downloadText(
      `chart-of-accounts-${todayISO()}.csv`,
      accountsToCsv(list),
      "text/csv;charset=utf-8"
    )
    toast({ title: `Exported ${list.length} accounts to CSV` })
  }

  function onExportPdf() {
    exportChartOfAccounts(accounts.data ?? [], balances, todayISO())
  }

  function onDownloadTemplate() {
    downloadText(
      "chart-of-accounts-template.csv",
      accountCsvTemplate(),
      "text/csv;charset=utf-8"
    )
  }

  // ---- Import ---------------------------------------------------------------

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
    const text = await file.text()
    const parsed = csvToAccounts(text)
    const codes = new Set(
      (accounts.data ?? []).map((a) => a.code.toLowerCase())
    )
    setImportMode("update")
    setPendingImport({
      ...parsed,
      fileName: file.name,
      existingCount: parsed.accounts.filter((a) =>
        codes.has(a.code.toLowerCase())
      ).length,
    })
  }

  async function onConfirmImport() {
    if (!pendingImport || pendingImport.accounts.length === 0) return
    try {
      const r = await importMut.mutateAsync({
        accounts: pendingImport.accounts,
        mode: importMode,
      })
      const parts = [
        r.created && `${r.created} created`,
        r.updated && `${r.updated} updated`,
        r.skipped && `${r.skipped} skipped`,
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
                .map((x) => `${x.code ?? `#${x.row}`}: ${x.error}`)
                .join("; ")
            : ""),
        variant: r.errors.length ? "destructive" : undefined,
      })
      setPendingImport(null)
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: NewAccount = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      subtype: form.subtype.trim() || null,
      description: form.description.trim() || null,
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing, input: payload })
        toast({ title: "Account updated" })
      } else {
        await createMut.mutateAsync(payload)
        toast({ title: "Account created" })
      }
      setOpen(false)
    } catch (err) {
      toast({
        title: "Could not save account",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function onConfirmDelete() {
    if (!deleteId) return
    try {
      await deleteMut.mutateAsync(deleteId)
      toast({ title: "Account deleted" })
      setDeleteId(null)
    } catch (err) {
      toast({
        title: "Could not delete account",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  if (accounts.isLoading) {
    return (
      <div>
        <PageHeader title="Chart of Accounts" />
        <LoadingBlock />
      </div>
    )
  }

  const list = accounts.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="All ledger accounts organised by type."
        actions={
          <div className="flex flex-wrap gap-2">
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
                <DropdownMenuItem onSelect={onDownloadTemplate}>
                  <Download className="size-4" /> Download CSV template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={list.length === 0}>
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onExportPdf}>
                  <FileText className="size-4" /> Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onExportCsv}>
                  <FileSpreadsheet className="size-4" /> Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add account
            </Button>
          </div>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={BookText}
          title="No accounts yet"
          description="Create your first account to start posting journal entries. A standard chart of accounts uses codes: 1000s assets, 2000s liabilities, 3000s equity, 4000s revenue, 5000s expenses."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add your first account
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {ACCOUNT_TYPES.map((type) => {
            const items = list
              .filter((a) => a.type === type)
              .sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { numeric: true })
              )
            if (items.length === 0) return null
            const typeTotal = round2(
              items.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)
            )
            return (
              <Card key={type}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {ACCOUNT_TYPE_LABELS[type]}
                    <Badge variant="secondary">{items.length}</Badge>
                  </CardTitle>
                  <div className="text-sm font-medium tnum text-muted-foreground">
                    {formatMoney(typeTotal)}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="w-24 px-4 py-2 font-medium md:px-6">
                            Code
                          </th>
                          <th className="px-4 py-2 font-medium md:px-6">
                            Account
                          </th>
                          <th className="hidden px-4 py-2 font-medium md:table-cell md:px-6">
                            Subtype
                          </th>
                          <th className="px-4 py-2 text-right font-medium md:px-6">
                            Balance
                          </th>
                          <th className="w-24 px-4 py-2 text-right font-medium md:px-6">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a) => {
                          const bal = balances.get(a.id) ?? 0
                          return (
                            <tr
                              key={a.id}
                              className="border-b last:border-0 transition-colors hover:bg-muted/40"
                            >
                              <td className="px-4 py-2.5 font-mono text-xs md:px-6">
                                {a.code}
                              </td>
                              <td className="px-4 py-2.5 md:px-6">
                                <div className="font-medium">{a.name}</div>
                                {a.description && (
                                  <div
                                    className="mt-0.5 max-w-md truncate text-xs text-muted-foreground"
                                    title={a.description}
                                  >
                                    {a.description}
                                  </div>
                                )}
                              </td>
                              <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell md:px-6">
                                {a.subtype || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium tnum md:px-6">
                                {formatMoney(bal)}
                              </td>
                              <td className="px-4 py-2.5 md:px-6">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => openEdit(a.id)}
                                    aria-label={`Edit ${a.name}`}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteId(a.id)}
                                    aria-label={`Delete ${a.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit account" : "Add account"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update the account details below."
                  : "Create a new account in your chart of accounts."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="1010"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as AccountType }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Account name</Label>
              <Input
                id="name"
                placeholder="Cash"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subtype">Subtype (optional)</Label>
              <Input
                id="subtype"
                placeholder="Current Asset"
                value={form.subtype}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtype: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What this account is used for, e.g. cash on hand and petty cash"
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editing ? "Save changes" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV import preview / confirm */}
      <Dialog
        open={pendingImport !== null}
        onOpenChange={(o) => !o && setPendingImport(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import chart of accounts</DialogTitle>
            <DialogDescription>
              {pendingImport?.fileName}: {pendingImport?.accounts.length ?? 0}{" "}
              valid row{pendingImport?.accounts.length === 1 ? "" : "s"}
              {pendingImport?.errors.length
                ? `, ${pendingImport.errors.length} with problems`
                : ""}
              .
            </DialogDescription>
          </DialogHeader>

          {pendingImport && pendingImport.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs scroll-thin">
              <div className="mb-1 font-medium text-destructive">
                These rows will be ignored:
              </div>
              <ul className="space-y-0.5">
                {pendingImport.errors.map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `Row ${e.row}: ` : ""}
                    {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pendingImport && pendingImport.accounts.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-md border scroll-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Code</th>
                    <th className="px-3 py-1.5 font-medium">Name</th>
                    <th className="px-3 py-1.5 font-medium">Type</th>
                    <th className="px-3 py-1.5 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingImport.accounts.map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{a.code}</td>
                      <td className="px-3 py-1.5">{a.name}</td>
                      <td className="px-3 py-1.5">
                        {ACCOUNT_TYPE_LABELS[a.type]}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-1.5 text-muted-foreground">
                        {a.description ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pendingImport && pendingImport.existingCount > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="import-mode">
                {pendingImport.existingCount} code
                {pendingImport.existingCount === 1 ? " already exists" : "s already exist"}
                . What should happen to them?
              </Label>
              <Select
                value={importMode}
                onValueChange={(v) => setImportMode(v as "update" | "skip")}
              >
                <SelectTrigger id="import-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">
                    Update existing accounts with the file&apos;s values
                  </SelectItem>
                  <SelectItem value="skip">
                    Keep existing accounts, only add new ones
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
            <Button
              onClick={onConfirmImport}
              disabled={
                importMut.isPending || !pendingImport?.accounts.length
              }
            >
              <Upload className="size-4" />
              Import {pendingImport?.accounts.length ?? 0} account
              {pendingImport?.accounts.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this account?"
        description="This permanently removes the account from your chart of accounts. Accounts that are referenced by journal entries cannot be deleted until those entries are removed."
        confirmLabel="Delete account"
        destructive
        loading={deleteMut.isPending}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
