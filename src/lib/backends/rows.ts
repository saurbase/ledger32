import type { Account, JournalEntry } from "@/lib/types";

// Map snake_case database rows (Supabase / PostgreSQL) to domain objects.

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : new Date().toISOString();
}

/** DATE columns: keep as yyyy-mm-dd. */
function isoDate(v: unknown): string {
  if (v instanceof Date) {
    const tz = v.getTimezoneOffset() * 60000;
    return new Date(v.getTime() - tz).toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

export function accountFromRow(r: any): Account {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    subtype: r.subtype ?? null,
    description: r.description ?? null,
    createdAt: iso(r.created_at),
  };
}

export function entriesFromRows(entries: any[], lines: any[]): JournalEntry[] {
  const byEntry = new Map<string, any[]>();
  for (const l of lines) {
    const list = byEntry.get(l.journal_entry_id) ?? [];
    list.push(l);
    byEntry.set(l.journal_entry_id, list);
  }
  return entries.map((e) => ({
    id: e.id,
    date: isoDate(e.date),
    description: e.description,
    reference: e.reference ?? null,
    isReversal: !!e.is_reversal,
    reversedEntryId: e.reversed_entry_id ?? null,
    isReversed: false,
    createdAt: iso(e.created_at),
    lines: (byEntry.get(e.id) ?? []).map((l) => ({
      id: l.id,
      accountId: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description ?? null,
    })),
  }));
}
