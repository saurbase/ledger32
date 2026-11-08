import { store } from "@/lib/store";
import { fail, handle, ok } from "@/lib/http";
import { NewAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const accounts = await store.listAccounts();
    return ok(accounts);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => null)) as NewAccount | null;
    if (!body) return fail("Invalid request body");
    const account = await store.createAccount(body);
    return ok(account, { status: 201 });
  });
}

export async function DELETE() {
  return handle(async () => {
    await store.resetAll();
    return ok({ reset: true });
  });
}
