"use client"

import * as React from "react"
import { BookText, Pencil, Plus, Trash2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  useJournal,
  useUpdateAccount,
} from "@/hooks/use-ledger"
import { accountBalance } from "@/lib/reports"
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  AccountType,
  formatMoney,
  NewAccount,
  round2,
} from "@/lib/types"
import { ConfirmDialog } from "@/components/ledger/confirm-dialog"
import { useUiStore } from "@/lib/ui-store"
import { EmptyState, LoadingBlock, PageHeader } from "./shared"

interface FormState {
  code: string
  name: string
  type: AccountType
  subtype: string
}

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  type: "asset",
  subtype: "",
}

export function ChartOfAccountsView() {
  const accounts = useAccounts()
  const journal = useJournal()
  const createMut = useCreateAccount()
  const updateMut = useUpdateAccount()
  const deleteMut = useDeleteAccount()
  const { toast } = useToast()

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
    })
    setOpen(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: NewAccount = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      subtype: form.subtype.trim() || null,
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
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add account
          </Button>
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
                              <td className="px-4 py-2.5 font-medium md:px-6">
                                {a.name}
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
