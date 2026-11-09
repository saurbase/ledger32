"use client"

import * as React from "react"
import {
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Loader2,
  PlugZap,
  Server,
  TableProperties,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useDataSource, useSaveDataSource, useStatus } from "@/hooks/use-ledger"
import {
  api,
  type BackendKind,
  type ConnectionCheck,
  type DataSourceInput,
} from "@/lib/api-client"
import { SCHEMA_SQL } from "@/lib/schema-sql"
import { cn } from "@/lib/utils"

const BACKENDS: {
  id: BackendKind
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    id: "local",
    label: "Local file",
    description: "Saved in a file on this computer. No setup needed.",
    icon: HardDrive,
  },
  {
    id: "supabase",
    label: "Supabase",
    description: "Your Supabase project, using its API URL and service key.",
    icon: Database,
  },
  {
    id: "postgres",
    label: "PostgreSQL",
    description: "Any PostgreSQL server: self-hosted, RDS, Neon, Supabase…",
    icon: Server,
  },
]

export const BACKEND_LABELS: Record<BackendKind, string> = {
  local: "Local file",
  supabase: "Supabase",
  postgres: "PostgreSQL",
}

interface FormState {
  backend: BackendKind
  supabaseUrl: string
  supabaseKey: string
  pgHost: string
  pgPort: string
  pgDatabase: string
  pgUser: string
  pgPassword: string
  pgSsl: boolean
}

const EMPTY: FormState = {
  backend: "local",
  supabaseUrl: "",
  supabaseKey: "",
  pgHost: "",
  pgPort: "5432",
  pgDatabase: "",
  pgUser: "",
  pgPassword: "",
  pgSsl: false,
}

function toInput(f: FormState): DataSourceInput {
  return {
    backend: f.backend,
    supabase: { url: f.supabaseUrl, serviceRoleKey: f.supabaseKey },
    postgres: {
      host: f.pgHost,
      port: Number(f.pgPort) || 5432,
      database: f.pgDatabase,
      user: f.pgUser,
      password: f.pgPassword,
      ssl: f.pgSsl,
    },
  }
}

/** Parse postgres://user:pass@host:5432/db?sslmode=require into form fields. */
function parseConnectionString(s: string): Partial<FormState> | null {
  try {
    const u = new URL(s.trim())
    if (!/^postgres(ql)?:$/.test(u.protocol)) return null
    const ssl = u.searchParams.get("sslmode")
    return {
      pgHost: decodeURIComponent(u.hostname),
      pgPort: u.port || "5432",
      pgDatabase: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
      pgUser: decodeURIComponent(u.username),
      pgPassword: decodeURIComponent(u.password),
      pgSsl: !!ssl && ssl !== "disable",
    }
  } catch {
    return null
  }
}

export function DataSourceCard() {
  const status = useStatus()
  const ds = useDataSource()
  const saveMut = useSaveDataSource()
  const { toast } = useToast()

  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [hasKey, setHasKey] = React.useState(false)
  const [hasPassword, setHasPassword] = React.useState(false)
  const [connString, setConnString] = React.useState("")
  const [check, setCheck] = React.useState<ConnectionCheck | null>(null)
  const [busy, setBusy] = React.useState<null | "test" | "init">(null)

  // Load saved settings into the form once.
  const loaded = React.useRef(false)
  React.useEffect(() => {
    if (loaded.current || !ds.data) return
    loaded.current = true
    const c = ds.data.config
    setForm({
      backend: c.backend,
      supabaseUrl: c.supabase?.url ?? "",
      supabaseKey: "",
      pgHost: c.postgres?.host ?? "",
      pgPort: String(c.postgres?.port ?? 5432),
      pgDatabase: c.postgres?.database ?? "",
      pgUser: c.postgres?.user ?? "",
      pgPassword: "",
      pgSsl: c.postgres?.ssl ?? false,
    })
    setHasKey(!!c.supabase?.hasServiceRoleKey)
    setHasPassword(!!c.postgres?.hasPassword)
  }, [ds.data])

  const active = status.data?.backend ?? "local"
  const source = ds.data?.source

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }))
    setCheck(null)
  }

  async function onTest() {
    setBusy("test")
    try {
      setCheck(await api.testDataSource(toInput(form)))
    } catch (err) {
      setCheck({
        ok: false,
        schemaReady: false,
        message: err instanceof Error ? err.message : "Test failed",
      })
    } finally {
      setBusy(null)
    }
  }

  async function onInitSchema() {
    setBusy("init")
    try {
      const r = await api.initDataSourceSchema(toInput(form))
      setCheck(r)
      toast({ title: "Tables created", description: r.message })
    } catch (err) {
      toast({
        title: "Could not create tables",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setBusy(null)
    }
  }

  async function onSave() {
    try {
      const r = await saveMut.mutateAsync(toInput(form))
      toast({
        title: `Now using ${BACKEND_LABELS[r.backend]}`,
        description: r.message,
      })
      setCheck(null)
      if (form.supabaseKey) setHasKey(true)
      if (form.pgPassword) setHasPassword(true)
      setForm((f) => ({ ...f, supabaseKey: "", pgPassword: "" }))
    } catch (err) {
      setCheck({
        ok: false,
        schemaReady: false,
        message: err instanceof Error ? err.message : "Could not save",
      })
    }
  }

  function onParseConnString() {
    const parsed = parseConnectionString(connString)
    if (!parsed) {
      toast({
        title: "Not a valid connection string",
        description: "Expected postgresql://user:password@host:5432/database",
        variant: "destructive",
      })
      return
    }
    update(parsed)
    setConnString("")
  }

  async function copySql() {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL.trim() + "\n")
      toast({ title: "SQL copied to clipboard" })
    } catch {
      toast({ title: "Could not copy", variant: "destructive" })
    }
  }

  const ActiveIcon = BACKENDS.find((b) => b.id === active)?.icon ?? HardDrive
  const isCurrent = form.backend === active

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data source</CardTitle>
        <CardDescription>
          Where your accounts and journal entries are stored. Settings are saved
          on this computer; nothing needs to be edited in the project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Currently active */}
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <ActiveIcon className="size-5 text-primary" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{BACKEND_LABELS[active]}</span>
              <Badge
                variant="secondary"
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-500"
              >
                In use
              </Badge>
              {source === "env" && (
                <Badge variant="outline">from .env</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {source === "env"
                ? "Configured by environment variables. Saving settings below will take precedence."
                : active === "local"
                  ? "Data is saved to a local file."
                  : "Data is read from and written to your database."}
            </p>
          </div>
        </div>

        {/* Backend picker */}
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
          {BACKENDS.map((b) => {
            const selected = form.backend === b.id
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ backend: b.id })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  <b.icon className="size-4 text-primary" />
                  {b.label}
                  {b.id === active && (
                    <span className="ml-auto text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Supabase settings */}
        {form.backend === "supabase" && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sb-url">Project URL</Label>
              <Input
                id="sb-url"
                placeholder="https://xxxx.supabase.co"
                value={form.supabaseUrl}
                onChange={(e) => update({ supabaseUrl: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-key">service_role key</Label>
              <Input
                id="sb-key"
                type="password"
                autoComplete="off"
                placeholder={hasKey ? "Saved. Leave blank to keep it" : "eyJhbGciOi…"}
                value={form.supabaseKey}
                onChange={(e) => update({ supabaseKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Supabase dashboard → Project Settings → API. The key is stored
                only on this computer and is never shown again.
              </p>
            </div>
          </div>
        )}

        {/* PostgreSQL settings */}
        {form.backend === "postgres" && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="pg-conn">Connection string (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="pg-conn"
                  type="password"
                  autoComplete="off"
                  placeholder="postgresql://user:password@host:5432/database"
                  value={connString}
                  onChange={(e) => setConnString(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      onParseConnString()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onParseConnString}
                  disabled={!connString.trim()}
                >
                  Fill fields
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-1.5">
                <Label htmlFor="pg-host">Host</Label>
                <Input
                  id="pg-host"
                  placeholder="localhost"
                  value={form.pgHost}
                  onChange={(e) => update({ pgHost: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-port">Port</Label>
                <Input
                  id="pg-port"
                  inputMode="numeric"
                  value={form.pgPort}
                  onChange={(e) =>
                    update({ pgPort: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pg-db">Database</Label>
                <Input
                  id="pg-db"
                  placeholder="ledger"
                  value={form.pgDatabase}
                  onChange={(e) => update({ pgDatabase: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-user">User</Label>
                <Input
                  id="pg-user"
                  placeholder="postgres"
                  autoComplete="off"
                  value={form.pgUser}
                  onChange={(e) => update({ pgUser: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pg-pass">Password</Label>
                <Input
                  id="pg-pass"
                  type="password"
                  autoComplete="off"
                  placeholder={hasPassword ? "Saved. Leave blank" : ""}
                  value={form.pgPassword}
                  onChange={(e) => update({ pgPassword: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label htmlFor="pg-ssl">Use SSL</Label>
                <p className="text-xs text-muted-foreground">
                  Required by most hosted databases (Supabase, Neon, RDS…).
                </p>
              </div>
              <Switch
                id="pg-ssl"
                checked={form.pgSsl}
                onCheckedChange={(v) => update({ pgSsl: v })}
              />
            </div>
          </div>
        )}

        {form.backend === "local" && (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Data is stored in <span className="font-mono">ledger.json</span> in
            the app&apos;s data folder on this computer. Back it up by copying
            that file, or export your reports.
          </p>
        )}

        {/* Test result */}
        {check && (
          <div
            className={cn(
              "flex gap-2 rounded-lg border p-3 text-sm",
              check.ok && check.schemaReady
                ? "border-emerald-500/40 bg-emerald-500/5"
                : check.ok
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-destructive/40 bg-destructive/5"
            )}
          >
            {check.ok && check.schemaReady ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  check.ok ? "text-amber-600" : "text-destructive"
                )}
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-words">{check.message}</p>
              {check.ok && !check.schemaReady && form.backend === "postgres" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onInitSchema}
                  disabled={busy !== null}
                >
                  {busy === "init" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <TableProperties className="size-4" />
                  )}
                  Create tables
                </Button>
              )}
              {check.ok && !check.schemaReady && form.backend === "supabase" && (
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    Open Supabase → SQL Editor → New query, paste this SQL and
                    click Run. Then test again.
                  </p>
                  <Button size="sm" variant="outline" onClick={copySql}>
                    <Copy className="size-4" /> Copy SQL
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2">
          {form.backend !== "local" && (
            <Button
              variant="outline"
              onClick={onTest}
              disabled={busy !== null || saveMut.isPending}
            >
              {busy === "test" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlugZap className="size-4" />
              )}
              Test connection
            </Button>
          )}
          <Button
            onClick={onSave}
            disabled={busy !== null || saveMut.isPending}
          >
            {saveMut.isPending && <Loader2 className="size-4 animate-spin" />}
            {isCurrent && source === "settings" ? "Save changes" : "Save & switch"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Switching doesn&apos;t move your data: each data source keeps its own
          accounts and entries. To copy your chart of accounts, export it as CSV
          and import it after switching.
        </p>
      </CardContent>
    </Card>
  )
}
