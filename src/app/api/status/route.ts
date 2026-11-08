import { store } from "@/lib/store";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    return ok({
      usingSupabase: store.isUsingSupabase(),
      timestamp: new Date().toISOString(),
    });
  });
}
