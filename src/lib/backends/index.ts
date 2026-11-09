import {
  getActiveConfig,
  type ConfigSource,
  type DataSourceConfig,
} from "@/lib/config";
import { createLocalBackend } from "./local";
import { checkPostgres, createPostgresBackend } from "./postgres";
import { checkSupabase, createSupabaseBackend } from "./supabase";
import type { Backend, ConnectionCheck } from "./types";

export type { Backend, ConnectionCheck } from "./types";

// Cache the backend (and its connection pool) across requests and across
// hot reloads in dev. It is rebuilt whenever the saved config changes.
const g = globalThis as unknown as {
  __ledgerBackend?: { key: string; backend: Backend; source: ConfigSource };
};

function build(config: DataSourceConfig): Backend {
  switch (config.backend) {
    case "supabase":
      return createSupabaseBackend(config.supabase!);
    case "postgres":
      return createPostgresBackend(config.postgres!);
    default:
      return createLocalBackend();
  }
}

export async function getBackend(): Promise<Backend> {
  return (await getBackendInfo()).backend;
}

export async function getBackendInfo(): Promise<{
  backend: Backend;
  source: ConfigSource;
}> {
  const { config, source } = await getActiveConfig();
  const key = JSON.stringify(config);
  const cached = g.__ledgerBackend;
  if (cached && cached.key === key) return cached;

  if (cached?.backend.close) {
    cached.backend.close().catch(() => {});
  }
  const backend = build(config);
  g.__ledgerBackend = { key, backend, source };
  return g.__ledgerBackend;
}

export async function checkConnection(config: DataSourceConfig): Promise<ConnectionCheck> {
  switch (config.backend) {
    case "supabase":
      return checkSupabase(config.supabase!);
    case "postgres":
      return checkPostgres(config.postgres!);
    default:
      return { ok: true, schemaReady: true, message: "Local file storage is always available." };
  }
}
