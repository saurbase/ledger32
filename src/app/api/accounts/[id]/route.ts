import { store } from "@/lib/store";
import { fail, handle, ok } from "@/lib/http";
import { NewAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Partial<NewAccount> | null;
    if (!body) return fail("Invalid request body");
    const account = await store.updateAccount(id, body);
    return ok(account);
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    await store.deleteAccount(id);
    return ok({ deleted: true });
  });
}
