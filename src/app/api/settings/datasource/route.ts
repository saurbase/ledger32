import {
  getActiveConfig,
  maskConfig,
  mergeSecrets,
  normalizeConfig,
  readSavedConfig,
  saveConfig,
} from "@/lib/config";
import { checkConnection, getBackendInfo } from "@/lib/backends";
import { fail, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Current data-source settings (secrets are never returned). */
export async function GET() {
  return handle(async () => {
    const { config, source } = await getActiveConfig();
    // Show previously entered settings for other backends too, so switching
    // back and forth doesn't require retyping them.
    const saved = await readSavedConfig();
    const merged = {
      ...config,
      supabase: config.supabase ?? saved?.supabase,
      postgres: config.postgres ?? saved?.postgres,
    };
    return ok({ config: maskConfig(merged), source });
  });
}

/**
 * Save and switch the data source. The connection is tested first; nothing is
 * saved if it fails or if the database tables are missing.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Invalid request body");
    const { config: active } = await getActiveConfig();
    const config = normalizeConfig(mergeSecrets(body, active));

    const check = await checkConnection(config);
    if (!check.ok) return fail(check.message);
    if (!check.schemaReady) return fail(check.message);

    await saveConfig(config);
    const { backend, source } = await getBackendInfo();
    return ok({ backend: backend.kind, source, message: check.message });
  });
}
