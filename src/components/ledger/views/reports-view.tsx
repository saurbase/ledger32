"use client"

import * as React from "react"
import {
  FileBarChart,
  FileDown,
  BookOpen,
  Scale,
  TrendingUp,
  ListOrdered,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useReport } from "@/hooks/use-ledger"
import {
  formatMoney,
  round2,
  type BalanceSheet,
  type IncomeStatement,
} from "@/lib/types"
import {
  exportBalanceSheet,
  exportGeneralLedger,
  exportIncomeStatement,
  exportTrialBalance,
} from "@/lib/pdf"
import { useUiStore } from "@/lib/ui-store"
import { EmptyState, LoadingBlock, PageHeader } from "./shared"

/**
 * Registry of each report tab's export function. Each report registers its
 * export callback here on mount so the parent can fire it via the Ctrl+E
 * keyboard shortcut without prop-drilling.
 */
const exportRegistry = new Map<string, () => void>()

export function ReportsView() {
  const [tab, setTab] = React.useState("trial-balance")
  const pendingAction = useUiStore((s) => s.pendingAction)
  const consumeAction = useUiStore((s) => s.consumeAction)

  // Fire the active report's export when Ctrl+E requests it.
  React.useEffect(() => {
    if (pendingAction === "export-pdf") {
      consumeAction()
      const fn = exportRegistry.get(tab)
      if (fn) {
        fn()
      }
    }
  }, [pendingAction, tab, consumeAction])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Reports"
        description="Generate and export the core financial statements as PDF."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="trial-balance">
            <ListOrdered className="size-4" /> Trial Balance
          </TabsTrigger>
          <TabsTrigger value="general-ledger">
            <BookOpen className="size-4" /> General Ledger
          </TabsTrigger>
          <TabsTrigger value="income-statement">
            <TrendingUp className="size-4" /> Income
          </TabsTrigger>
          <TabsTrigger value="balance-sheet">
            <Scale className="size-4" /> Balance Sheet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance" className="mt-4">
          <TrialBalanceReport />
        </TabsContent>
        <TabsContent value="general-ledger" className="mt-4">
          <GeneralLedgerReport />
        </TabsContent>
        <TabsContent value="income-statement" className="mt-4">
          <IncomeStatementReport />
        </TabsContent>
        <TabsContent value="balance-sheet" className="mt-4">
          <BalanceSheetReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function dateLabel() {
  return new Date().toISOString().slice(0, 10)
}

function ReportActions({
  onExport,
  disabled,
}: {
  onExport: () => void
  disabled?: boolean
}) {
  const { toast } = useToast()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => {
        try {
          onExport()
          toast({ title: "PDF exported" })
        } catch (err) {
          toast({
            title: "Export failed",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          })
        }
      }}
    >
      <FileDown className="size-4" /> Export PDF
    </Button>
  )
}

// ---- Trial balance -------------------------------------------------------

type TrialBalanceData = {
  rows: { account: { code: string; name: string }; debit: number; credit: number }[]
  generatedAt: string
}

function TrialBalanceReport() {
  const { data, isLoading } = useReport<TrialBalanceData>("trial-balance")

  const rows = data?.rows ?? []

  // Register this report's export so Ctrl+E can trigger it.
  React.useEffect(() => {
    exportRegistry.set("trial-balance", () => exportTrialBalance(rows, dateLabel()))
    return () => {
      exportRegistry.delete("trial-balance")
    }
  }, [rows])

  if (isLoading) return <LoadingBlock label="Building trial balance…" />

  const totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0))
  const totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0))
  const balanced = round2(totalDebit - totalCredit) === 0

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Trial Balance</CardTitle>
        <ReportActions
          disabled={rows.length === 0}
          onExport={() =>
            exportTrialBalance(rows, dateLabel())
          }
        />
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileBarChart}
              title="Nothing to report"
              description="Post some journal entries to populate the trial balance."
            />
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-24 px-4 py-2 font-medium md:px-6">Code</th>
                  <th className="px-4 py-2 font-medium md:px-6">Account</th>
                  <th className="w-32 px-4 py-2 text-right font-medium md:px-6">
                    Debit
                  </th>
                  <th className="w-32 px-4 py-2 text-right font-medium md:px-6">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.account.code} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono text-xs md:px-6">
                      {r.account.code}
                    </td>
                    <td className="px-4 py-2 font-medium md:px-6">
                      {r.account.name}
                    </td>
                    <td className="px-4 py-2 text-right tnum md:px-6">
                      {r.debit ? formatMoney(r.debit) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tnum md:px-6">
                      {r.credit ? formatMoney(r.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td colSpan={2} className="px-4 py-2.5 md:px-6">
                    Totals
                  </td>
                  <td className="px-4 py-2.5 text-right tnum md:px-6">
                    {formatMoney(totalDebit)}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum md:px-6">
                    {formatMoney(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="flex items-center gap-2 border-t px-4 py-3 text-xs md:px-6">
              <Badge
                variant={balanced ? "secondary" : "destructive"}
                className={
                  balanced
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
                    : ""
                }
              >
                {balanced ? "Balanced" : "Out of balance"}
              </Badge>
              <span className="text-muted-foreground">
                {balanced
                  ? "Total debits equal total credits."
                  : "Debits and credits do not match."}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---- General ledger ------------------------------------------------------

type GeneralLedgerData = {
  ledgers: {
    account: { code: string; name: string }
    lines: {
      date: string
      description: string
      reference?: string | null
      debit: number
      credit: number
      runningBalance: number
      isReversal: boolean
    }[]
    totalDebit: number
    totalCredit: number
    closingBalance: number
  }[]
  generatedAt: string
}

function GeneralLedgerReport() {
  const { data, isLoading } = useReport<GeneralLedgerData>("general-ledger")

  const ledgers = data?.ledgers ?? []

  React.useEffect(() => {
    exportRegistry.set("general-ledger", () =>
      exportGeneralLedger(ledgers, dateLabel())
    )
    return () => {
      exportRegistry.delete("general-ledger")
    }
  }, [ledgers])

  if (isLoading) return <LoadingBlock label="Building general ledger…" />

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">General Ledger</CardTitle>
        <ReportActions
          disabled={ledgers.length === 0}
          onExport={() => exportGeneralLedger(ledgers, dateLabel())}
        />
      </CardHeader>
      <CardContent className="p-0">
        {ledgers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BookOpen}
              title="No ledger activity"
              description="Once you post journal entries, each account's activity appears here."
            />
          </div>
        ) : (
          <div className="divide-y">
            {ledgers.map((l) => (
              <div key={l.account.code} className="px-4 py-4 md:px-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {l.account.code}
                    </span>
                    <span className="text-sm font-semibold">
                      {l.account.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium tnum">
                    Closing: {formatMoney(l.closingBalance)}
                  </span>
                </div>
                <div className="overflow-x-auto scroll-thin rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
                        <th className="w-24 px-3 py-1.5 font-medium">Date</th>
                        <th className="px-3 py-1.5 font-medium">Description</th>
                        <th className="w-20 px-3 py-1.5 font-medium">Ref</th>
                        <th className="w-24 px-3 py-1.5 text-right font-medium">
                          Debit
                        </th>
                        <th className="w-24 px-3 py-1.5 text-right font-medium">
                          Credit
                        </th>
                        <th className="w-24 px-3 py-1.5 text-right font-medium">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.lines.map((ln, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-mono">{ln.date}</td>
                          <td className="px-3 py-1.5">
                            {ln.description}
                            {ln.isReversal && (
                              <span className="ml-1 text-muted-foreground">
                                (reversal)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {ln.reference ?? ""}
                          </td>
                          <td className="px-3 py-1.5 text-right tnum">
                            {ln.debit ? formatMoney(ln.debit) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right tnum">
                            {ln.credit ? formatMoney(ln.credit) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium tnum">
                            {formatMoney(ln.runningBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---- Income statement ----------------------------------------------------

function IncomeStatementReport() {
  const { data, isLoading } = useReport<IncomeStatement & { generatedAt: string }>(
    "income-statement"
  )

  const is = data
  const revenue = is?.revenue ?? []
  const expenses = is?.expenses ?? []
  const totalRevenue = is?.totalRevenue ?? 0
  const totalExpenses = is?.totalExpenses ?? 0
  const netIncome = is?.netIncome ?? 0
  const empty = revenue.length === 0 && expenses.length === 0

  React.useEffect(() => {
    exportRegistry.set("income-statement", () =>
      exportIncomeStatement(
        { revenue, expenses, totalRevenue, totalExpenses, netIncome },
        dateLabel()
      )
    )
    return () => {
      exportRegistry.delete("income-statement")
    }
  }, [revenue, expenses, totalRevenue, totalExpenses, netIncome])

  if (isLoading) return <LoadingBlock label="Building income statement…" />

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Income Statement</CardTitle>
        <ReportActions
          disabled={empty}
          onExport={() =>
            exportIncomeStatement(
              {
                revenue,
                expenses,
                totalRevenue,
                totalExpenses,
                netIncome,
              },
              dateLabel()
            )
          }
        />
      </CardHeader>
      <CardContent className="p-0">
        {empty ? (
          <div className="p-6">
            <EmptyState
              icon={TrendingUp}
              title="No revenue or expenses"
              description="Post entries to revenue or expense accounts to see your profit or loss."
            />
          </div>
        ) : (
          <div className="divide-y">
            <ReportSection title="Revenue" rows={revenue} total={totalRevenue} />
            <ReportSection
              title="Expenses"
              rows={expenses}
              total={totalExpenses}
            />
            <div className="flex items-center justify-between gap-4 bg-primary/10 px-4 py-4 md:px-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Net Income
                </div>
                <div className="text-xs text-muted-foreground">
                  Revenue − Expenses
                </div>
              </div>
              <div
                className={
                  "text-2xl font-bold tnum " +
                  (netIncome >= 0
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-destructive")
                }
              >
                {formatMoney(netIncome)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReportSection({
  title,
  rows,
  total,
}: {
  title: string
  rows: { account: { code: string; name: string }; amount: number }[]
  total: number
}) {
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-1 text-muted-foreground">No accounts</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.account.code} className="border-b last:border-0">
                  <td className="w-20 py-2 font-mono text-xs text-muted-foreground">
                    {r.account.code}
                  </td>
                  <td className="py-2 font-medium">{r.account.name}</td>
                  <td className="py-2 text-right tnum">
                    {formatMoney(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={2} className="py-2">
                Total {title}
              </td>
              <td className="py-2 text-right tnum">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---- Balance sheet -------------------------------------------------------

function BalanceSheetReport() {
  const { data, isLoading } = useReport<BalanceSheet & { generatedAt: string }>(
    "balance-sheet"
  )

  const bs = data
  const assets = bs?.assets ?? []
  const liabilities = bs?.liabilities ?? []
  const equity = bs?.equity ?? []
  const totalAssets = bs?.totalAssets ?? 0
  const totalLiabilities = bs?.totalLiabilities ?? 0
  const totalEquity = bs?.totalEquity ?? 0
  const netIncome = bs?.netIncome ?? 0
  const balanced = bs?.balanced ?? true
  const empty =
    assets.length === 0 && liabilities.length === 0 && equity.length === 0

  React.useEffect(() => {
    exportRegistry.set("balance-sheet", () =>
      exportBalanceSheet(
        {
          assets,
          liabilities,
          equity,
          totalAssets,
          totalLiabilities,
          totalEquity,
          netIncome,
          balanced,
        },
        dateLabel()
      )
    )
    return () => {
      exportRegistry.delete("balance-sheet")
    }
  }, [assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome, balanced])

  if (isLoading) return <LoadingBlock label="Building balance sheet…" />

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Balance Sheet</CardTitle>
        <ReportActions
          disabled={empty}
          onExport={() =>
            exportBalanceSheet(
              {
                assets,
                liabilities,
                equity,
                totalAssets,
                totalLiabilities,
                totalEquity,
                netIncome,
                balanced,
              },
              dateLabel()
            )
          }
        />
      </CardHeader>
      <CardContent className="p-0">
        {empty ? (
          <div className="p-6">
            <EmptyState
              icon={Scale}
              title="No balances to report"
              description="Post entries to asset, liability and equity accounts to build your balance sheet."
            />
          </div>
        ) : (
          <div className="divide-y">
            <BSSection title="Assets" rows={assets} total={totalAssets} />
            <BSSection
              title="Liabilities"
              rows={liabilities}
              total={totalLiabilities}
            />
            <div className="px-4 py-4 md:px-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Equity
              </div>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <tbody>
                    {equity.map((r) => (
                      <tr key={r.account.code} className="border-b last:border-0">
                        <td className="w-20 py-2 font-mono text-xs text-muted-foreground">
                          {r.account.code}
                        </td>
                        <td className="py-2 font-medium">{r.account.name}</td>
                        <td className="py-2 text-right tnum">
                          {formatMoney(r.amount)}
                        </td>
                      </tr>
                    ))}
                    {round2(netIncome) !== 0 && (
                      <tr className="border-b last:border-0">
                        <td className="w-20 py-2 font-mono text-xs text-muted-foreground">
                          —
                        </td>
                        <td className="py-2 font-medium">
                          Net Income (current period)
                        </td>
                        <td className="py-2 text-right tnum">
                          {formatMoney(netIncome)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={2} className="py-2">
                        Total Equity
                      </td>
                      <td className="py-2 text-right tnum">
                        {formatMoney(totalEquity)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              <BSTotalCell
                label="Total Assets"
                value={totalAssets}
                tone="primary"
              />
              <BSTotalCell
                label="Total Liabilities"
                value={totalLiabilities}
              />
              <BSTotalCell label="Total Equity" value={totalEquity} />
            </div>

            <div
              className={
                "flex items-center gap-2 px-4 py-3 text-sm md:px-6 " +
                (balanced
                  ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/5 text-destructive")
              }
            >
              <Badge
                variant={balanced ? "secondary" : "destructive"}
                className={
                  balanced
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
                    : ""
                }
              >
                {balanced ? "Balanced" : "Out of balance"}
              </Badge>
              <span>
                {balanced
                  ? "Assets = Liabilities + Equity."
                  : `Difference of ${formatMoney(
                      round2(
                        totalAssets - (totalLiabilities + totalEquity)
                      )
                    )}. Check your opening equity entries.`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BSSection({
  title,
  rows,
  total,
}: {
  title: string
  rows: { account: { code: string; name: string }; amount: number }[]
  total: number
}) {
  return (
    <div className="px-4 py-4 md:px-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-1 text-muted-foreground">No accounts</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.account.code} className="border-b last:border-0">
                  <td className="w-20 py-2 font-mono text-xs text-muted-foreground">
                    {r.account.code}
                  </td>
                  <td className="py-2 font-medium">{r.account.name}</td>
                  <td className="py-2 text-right tnum">
                    {formatMoney(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={2} className="py-2">
                Total {title}
              </td>
              <td className="py-2 text-right tnum">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function BSTotalCell({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "primary"
}) {
  return (
    <div
      className={
        "p-4 md:p-5 " +
        (tone === "primary" ? "bg-primary/5" : "bg-background")
      }
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-bold tnum " +
          (tone === "primary" ? "text-primary" : "")
        }
      >
        {formatMoney(value)}
      </div>
    </div>
  )
}
