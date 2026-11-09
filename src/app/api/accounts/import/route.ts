import { store } from "@/lib/store";
import { fail, handle, ok } from "@/lib/http";
import { NewAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

/**
 * Bulk-import accounts.
 * Body: { accounts: NewAccount[], mode?: "update" | "skip" }
 *  - "update" (default): accounts whose code already exists are overwritten
 *  - "skip": existing codes are left untouched
 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as {
      accounts?: NewAccount[];
      mode?: "update" | "skip";
    } | null;
    if (!body || !Array.isArray(body.accounts))
      return fail("Expected { accounts: [...] }");
    if (body.accounts.length === 0) return fail("No accounts to import");
    if (body.accounts.length > MAX_ROWS)
      return fail(`Too many rows (max ${MAX_ROWS})`);
    const mode = body.mode === "skip" ? "skip" : "update";
    const result = await store.importAccounts(body.accounts, mode);
    return ok(result);
  });
}
