import { store } from "@/lib/store";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    await store.deleteJournalEntry(id);
    return ok({ deleted: true });
  });
}
