import { getActiveConfig, mergeSecrets, normalizeConfig } from "@/lib/config";
import { checkConnection } from "@/lib/backends";
import { fail, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Test connection settings without saving them. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Invalid request body");
    const { config: active } = await getActiveConfig();
    const config = normalizeConfig(mergeSecrets(body, active));
    return ok(await checkConnection(config));
  });
}
