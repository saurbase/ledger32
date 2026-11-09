import { store } from "@/lib/store";
import { fail, handle, ok } from "@/lib/http";
import type { ImportJournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 5000;

/**
 * Bulk-import journal entries.
 * Body: { entries: ImportJournalEntry[], skipDuplicates?: boolean }
 * Lines reference accounts by `accountCode`. With skipDuplicates (default
 * true), entries identical to an existing one are skipped.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as {
      entries?: ImportJournalEntry[];
      skipDuplicates?: boolean;
    } | null;
    if (!body || !Array.isArray(body.entries))
      return fail("Expected { entries: [...] }");
    if (body.entries.length === 0) return fail("No journal entries to import");
    if (body.entries.length > MAX_ENTRIES)
      return fail(`Too many entries (max ${MAX_ENTRIES})`);
    const result = await store.importJournalEntries(
      body.entries,
      body.skipDuplicates !== false
    );
    return ok(result);
  });
}
