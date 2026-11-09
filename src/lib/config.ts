import { promises as fs } from "fs";
import path from "path";

// =========================================================================
// Data-source configuration, editable from Settings → Data source.
//
// Stored as JSON next to the local data file (LEDGER_DATA_DIR, which the
// desktop app points at the OS user-data folder). If no config file exists,
// Supabase keys from environment variables (.env) are still honoured so older
// setups keep working.
// =========================================================================

export type BackendKind = "local" | "supabase" | "postgres";

export interface SupabaseSettings {
  url: string;
  serviceRoleKey: string;
}

export interface PostgresSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface DataSourceConfig {
  backend: BackendKind;
  supabase?: SupabaseSettings;
  postgres?: PostgresSettings;
}

/** Where the active configuration came from. */
export type ConfigSource = "settings" | "env" | "default";

export const DATA_DIR =
  process.env.LEDGER_DATA_DIR || path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export async function readSavedConfig(): Promise<DataSourceConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DataSourceConfig;
    if (!parsed || !["local", "supabase", "postgres"].includes(parsed.backend))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

function envConfig(): DataSourceConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    return { backend: "supabase", supabase: { url, serviceRoleKey: key } };
  }
  return null;
}

/** The configuration currently in effect. */
export async function getActiveConfig(): Promise<{
  config: DataSourceConfig;
  source: ConfigSource;
}> {
  const saved = await readSavedConfig();
  if (saved) return { config: saved, source: "settings" };
  const env = envConfig();
  if (env) return { config: env, source: "env" };
  return { config: { backend: "local" }, source: "default" };
}

export async function saveConfig(config: DataSourceConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Only keep the settings for the selected backend plus any others the
  // user entered, so switching back later doesn't require retyping them.
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600, // contains credentials: owner read/write only
  });
}

// ---- Validation / normalisation -----------------------------------------

export function normalizeConfig(input: unknown): DataSourceConfig {
  const body = (input ?? {}) as Partial<DataSourceConfig>;
  const backend = body.backend;
  if (backend !== "local" && backend !== "supabase" && backend !== "postgres")
    throw new Error("Choose a data source: local, supabase or postgres");

  const out: DataSourceConfig = { backend };
  if (body.supabase) {
    out.supabase = {
      url: String(body.supabase.url ?? "").trim().replace(/\/+$/, ""),
      serviceRoleKey: String(body.supabase.serviceRoleKey ?? "").trim(),
    };
  }
  if (body.postgres) {
    const port = Number(body.postgres.port ?? 5432);
    out.postgres = {
      host: String(body.postgres.host ?? "").trim(),
      port: Number.isFinite(port) && port > 0 ? Math.floor(port) : 5432,
      database: String(body.postgres.database ?? "").trim(),
      user: String(body.postgres.user ?? "").trim(),
      password: String(body.postgres.password ?? ""),
      ssl: !!body.postgres.ssl,
    };
  }

  if (backend === "supabase") {
    const s = out.supabase;
    if (!s?.url) throw new Error("Supabase project URL is required");
    if (!/^https?:\/\//i.test(s.url))
      throw new Error("Supabase URL must start with https://");
    if (!s.serviceRoleKey) throw new Error("Supabase service_role key is required");
  }
  if (backend === "postgres") {
    const p = out.postgres;
    if (!p?.host) throw new Error("PostgreSQL host is required");
    if (!p.database) throw new Error("PostgreSQL database name is required");
    if (!p.user) throw new Error("PostgreSQL user is required");
  }
  return out;
}

/**
 * Secrets are never sent back to the browser. When the user saves without
 * retyping a secret (empty field), keep the one already stored.
 */
export function mergeSecrets(
  incoming: Partial<DataSourceConfig> | null | undefined,
  existing: DataSourceConfig | null
): Partial<DataSourceConfig> {
  const next = JSON.parse(JSON.stringify(incoming ?? {})) as Partial<DataSourceConfig>;
  if (next.supabase && !next.supabase.serviceRoleKey && existing?.supabase) {
    next.supabase.serviceRoleKey = existing.supabase.serviceRoleKey;
  }
  if (next.postgres && !next.postgres.password && existing?.postgres) {
    next.postgres.password = existing.postgres.password;
  }
  return next;
}

/** Public, secret-free view of a config for the Settings screen. */
export function maskConfig(config: DataSourceConfig) {
  return {
    backend: config.backend,
    supabase: config.supabase
      ? {
          url: config.supabase.url,
          serviceRoleKey: "",
          hasServiceRoleKey: !!config.supabase.serviceRoleKey,
        }
      : null,
    postgres: config.postgres
      ? {
          host: config.postgres.host,
          port: config.postgres.port,
          database: config.postgres.database,
          user: config.postgres.user,
          password: "",
          hasPassword: !!config.postgres.password,
          ssl: config.postgres.ssl,
        }
      : null,
  };
}

export type MaskedConfig = ReturnType<typeof maskConfig>;
