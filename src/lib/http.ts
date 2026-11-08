import { NextResponse } from "next/server";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = /not found/i.test(message) ? 404 : 400;
    return fail(message, status);
  });
}
