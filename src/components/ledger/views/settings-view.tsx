"use client"

import * as React from "react"
import {
  AlertTriangle,
  Database,
  HardDrive,
  Sparkles,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  useAccounts,
  useJournal,
  useReset,
  useSeed,
  useStatus,
} from "@/hooks/use-ledger"
import { ConfirmDialog } from "@/components/ledger/confirm-dialog"
import { PageHeader } from "./shared"

export function SettingsView() {
  const status = useStatus()
  const resetMut = useReset()
  const seedMut = useSeed()
  const accounts = useAccounts()
  const journal = useJournal()
  const { toast } = useToast()

  const [resetOpen, setResetOpen] = React.useState(false)
  const [seedOpen, setSeedOpen] = React.useState(false)

  const usingSupabase = status.data?.usingSupabase ?? false
  const accountCount = accounts.data?.length ?? 0
  const entryCount = journal.data?.length ?? 0

  async function onConfirmReset() {
    try {
      await resetMut.mutateAsync()
      toast({ title: "All data deleted", description: "Your ledger is now empty." })
      setResetOpen(false)
    } catch (err) {
      toast({
        title: "Could not reset",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  async function onConfirmSeed() {
    try {
      await seedMut.mutateAsync()
      toast({
        title: "Sample data loaded",
        description: "A standard chart of accounts and sample entries were created.",
      })
      setSeedOpen(false)
    } catch (err) {
      toast({
        title: "Could not load sample data",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your data source and start over when needed."
      />

      {/* Data source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Data source
          </CardTitle>
          <CardDescription>
            Where your accounting data is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            {usingSupabase ? (
              <Database className="size-5 text-primary" />
            ) : (
              <HardDrive className="size-5 text-primary" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {usingSupabase ? "Supabase" : "Local store (fallback)"}
                </span>
                <Badge
                  variant={usingSupabase ? "secondary" : "outline"}
                  className={
                    usingSupabase
                      ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
                      : ""
                  }
                >
                  {usingSupabase ? "Connected" : "Not configured"}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {usingSupabase
                  ? "Data is read and written to your Supabase project tables."
                  : "Add your Supabase keys in .env to sync. Until then, data is saved to a local file on the server."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Accounts
              </div>
              <div className="mt-1 text-2xl font-semibold tnum">
                {accountCount}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Journal entries
              </div>
              <div className="mt-1 text-2xl font-semibold tnum">
                {entryCount}
              </div>
            </div>
          </div>

          {!usingSupabase && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h4 className="text-sm font-semibold">Connect your Supabase account</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Open your Supabase project →{" "}
                  <span className="font-mono text-foreground">
                    Project Settings → API
                  </span>
                  .
                </li>
                <li>
                  Copy the <span className="font-medium">Project URL</span> and{" "}
                  <span className="font-medium">service_role</span> key into the{" "}
                  <span className="font-mono text-foreground">.env</span> file:
                  <pre className="mt-2 overflow-x-auto rounded-md bg-background p-3 text-xs scroll-thin">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...`}
                  </pre>
                </li>
                <li>
                  Run the SQL in{" "}
                  <span className="font-mono text-foreground">
                    supabase/schema.sql
                  </span>{" "}
                  in the Supabase SQL editor to create the tables.
                </li>
                <li>Restart the dev server.</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sample data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Sample data
          </CardTitle>
          <CardDescription>
            Load a standard chart of accounts plus a few sample entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              This wipes all existing data and replaces it with a starter chart of
              accounts (Assets, Liabilities, Equity, Revenue, Expenses) and three
              example journal entries.
            </p>
            <Button
              variant="outline"
              onClick={() => setSeedOpen(true)}
              disabled={seedMut.isPending}
              className="shrink-0"
            >
              <Sparkles className="size-4" /> Load sample data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete everything</p>
              <p className="text-sm text-muted-foreground">
                Permanently removes every account and journal entry. This cannot
                be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setResetOpen(true)}
              disabled={resetMut.isPending}
              className="shrink-0"
            >
              <Trash2 className="size-4" /> Delete all data
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Delete all accounts and journal entries?"
        description="This permanently deletes every account and every journal entry (including reversals). There is no undo. Consider exporting your reports to PDF first."
        confirmLabel="Yes, delete everything"
        destructive
        loading={resetMut.isPending}
        onConfirm={onConfirmReset}
      />

      <ConfirmDialog
        open={seedOpen}
        onOpenChange={setSeedOpen}
        title="Load sample data?"
        description="This will delete all current data and replace it with a starter chart of accounts and three sample journal entries."
        confirmLabel="Load sample data"
        loading={seedMut.isPending}
        onConfirm={onConfirmSeed}
      />
    </div>
  )
}
