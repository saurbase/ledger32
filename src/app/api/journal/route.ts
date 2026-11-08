import { store } from "@/lib/store";
import { fail, handle, ok } from "@/lib/http";
import { NewJournalEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const entries = await store.listJournalEntries();
    return ok(entries);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as NewJournalEntry | null;
    if (!body) return fail("Invalid request body");
    const entry = await store.createJournalEntry(body);
    return ok(entry, { status: 201 });
  });
}
