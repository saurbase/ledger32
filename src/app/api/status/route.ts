import { store } from "@/lib/store";
import { handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { backend, source } = await store.getStatus();
    return ok({
      backend,
      source,
      usingSupabase: backend === "supabase",
      timestamp: new Date().toISOString(),
    });
  });
}
