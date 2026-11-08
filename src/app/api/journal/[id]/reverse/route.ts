import { store } from "@/lib/store";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const reversal = await store.reverseJournalEntry(id);
    return ok(reversal, { status: 201 });
  });
}
