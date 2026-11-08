import { store } from "@/lib/store";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    await store.seedSampleData();
    return ok({ seeded: true });
  });
}
