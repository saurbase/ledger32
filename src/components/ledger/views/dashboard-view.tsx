"use client"

import * as React from "react"
import {
  ArrowRight,
  BookText,
  CheckCircle2,
  Plus,
  ScrollText,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAccounts, useJournal, useSummary } from "@/hooks/use-ledger"
import { useNav } from "@/components/ledger/nav"
import {
  ACCOUNT_TYPE_LABELS,
  formatMoney,
  round2,
} from "@/lib/types"
import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatCard,
} from "./shared"

export function DashboardView() {
  const { setView } = useNav()
  const summary = useSummary()
  const journal = useJournal()
  const accounts = useAccounts()

  const loading = summary.isLoading || journal.isLoading

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="A snapshot of your books at a glance."
        />
        <LoadingBlock />
      </div>
    )
  }

  const totals = summary.data?.totalsByType ?? {}
  const entries = journal.data ?? []
  const recent = entries.slice(0, 6)
  const accountList = accounts.data ?? []

  const totalAssets = totals.asset ?? 0
  const totalLiabilities = totals.liability ?? 0
  const totalEquity = totals.equity ?? 0
  const totalRevenue = totals.revenue ?? 0
  const totalExpenses = totals.expense ?? 0
  const netIncome = round2(totalRevenue - totalExpenses)

  // Balanced check: Assets == Liabilities + Equity + Net Income
  const balanced =
    round2(totalAssets - (totalLiabilities + totalEquity + netIncome)) === 0

  const hasData = accountList.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A snapshot of your books at a glance."
        actions={
          <>
            <Button variant="outline" onClick={() => setView("accounts")}>
              <BookText className="size-4" /> Accounts
            </Button>
            <Button onClick={() => setView("journal")}>
              <Plus className="size-4" /> New Entry
            </Button>
          </>
        }
      />

      {!hasData ? (
        <EmptyState
          icon={BookText}
          title="Your ledger is empty"
          description="Start by setting up a chart of accounts, then record your first journal entry. You can also load a sample chart of accounts from Settings."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setView("accounts")}>
                <Plus className="size-4" /> Add accounts
              </Button>
              <Button variant="outline" onClick={() => setView("settings")}>
                Load sample data
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Assets"
              value={formatMoney(totalAssets)}
              hint={ACCOUNT_TYPE_LABELS.asset}
              tone="primary"
              icon={Wallet}
            />
            <StatCard
              label="Total Liabilities"
              value={formatMoney(totalLiabilities)}
              hint={ACCOUNT_TYPE_LABELS.liability}
            />
            <StatCard
              label="Net Income"
              value={formatMoney(netIncome)}
              hint={`Revenue ${formatMoney(totalRevenue)} − Expenses ${formatMoney(
                totalExpenses
              )}`}
              tone={netIncome >= 0 ? "positive" : "negative"}
              icon={TrendingUp}
            />
            <StatCard
              label="Journal Entries"
              value={String(entries.length)}
              hint={`${accountList.length} accounts`}
            />
          </div>

          <Card
            className={
              balanced
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5"
            }
          >
            <CardContent className="flex items-center gap-3 p-4">
              {balanced ? (
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-500" />
              ) : (
                <AlertTriangle className="size-5 text-destructive" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {balanced
                    ? "Books are balanced"
                    : "Books are out of balance"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {balanced
                    ? "Assets = Liabilities + Equity + Net Income."
                    : "Assets should equal Liabilities + Equity + Net Income. Review your opening entries."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("reports")}
              >
                View reports <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Recent journal entries</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("journal")}
                >
                  View all <ArrowRight className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {recent.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={ScrollText}
                      title="No entries yet"
                      description="Record your first double-entry transaction."
                      action={
                        <Button size="sm" onClick={() => setView("journal")}>
                          <Plus className="size-4" /> New entry
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recent.map((e) => {
                      const total = round2(
                        e.lines.reduce((s, l) => s + (l.debit || 0), 0)
                      )
                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 px-4 py-3 md:px-6"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {e.description}
                              </p>
                              {e.isReversal && (
                                <Badge variant="secondary" className="shrink-0">
                                  Reversal
                                </Badge>
                              )}
                              {e.isReversed && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-destructive"
                                >
                                  Reversed
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {e.date}
                              {e.reference ? ` · ${e.reference}` : ""} ·{" "}
                              {e.lines.length} lines
                            </p>
                          </div>
                          <div className="text-right text-sm font-medium tnum">
                            {formatMoney(total)}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  ["asset", "liability", "equity", "revenue", "expense"] as const
                ).map((type) => (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[type]}
                      </span>
                      <span className="font-medium tnum">
                        {formatMoney(totals[type] ?? 0)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              2,
                              (Math.abs(totals[type] ?? 0) /
                                (Math.abs(totalAssets) || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
