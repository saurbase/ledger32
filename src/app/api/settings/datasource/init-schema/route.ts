import { getActiveConfig, mergeSecrets, normalizeConfig } from "@/lib/config";
import { checkConnection } from "@/lib/backends";
import { initPostgresSchema } from "@/lib/backends/postgres";
import { fail, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Create (or upgrade) the Ledger tables in a PostgreSQL database. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Invalid request body");
    const { config: active } = await getActiveConfig();
    const config = normalizeConfig(mergeSecrets(body, active));
    if (config.backend !== "postgres")
      return fail("Tables can only be created automatically for PostgreSQL. For Supabase, run the SQL in the Supabase SQL editor.");
    try {
      await initPostgresSchema(config.postgres!);
    } catch (err) {
      return fail(
        `Could not create tables: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return ok(await checkConnection(config));
  });
}
