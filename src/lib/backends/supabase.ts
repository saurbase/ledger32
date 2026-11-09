import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseSettings } from "@/lib/config";
import type { Account, JournalEntry, NewAccount } from "@/lib/types";
import { accountFromRow, entriesFromRows } from "./rows";
import type { Backend, ConnectionCheck } from "./types";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const PAGE = 1000; // PostgREST's default max rows per request

function client(s: SupabaseSettings): SupabaseClient {
  return createClient(s.url, s.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Fetch every row of a table, paging past PostgREST's row limit. */
async function fetchAll(sb: SupabaseClient, table: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export function createSupabaseBackend(settings: SupabaseSettings): Backend {
  const sb = client(settings);

  return {
    kind: "supabase",

    async listAccounts() {
      return (await fetchAll(sb, "accounts")).map(accountFromRow);
    },

    async insertAccount(a) {
      const { data, error } = await sb
        .from("accounts")
        .insert({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          subtype: a.subtype ?? null,
          description: a.description ?? null,
          created_at: a.createdAt,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return accountFromRow(data);
    },

    async updateAccount(id, patch: Partial<NewAccount>) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["code", "name", "type", "subtype", "description"] as const) {
        if (patch[k] !== undefined) row[k] = patch[k] ?? null;
      }
      const { data, error } = await sb
        .from("accounts")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Account not found");
      return accountFromRow(data);
    },

    async deleteAccount(id) {
      const { error } = await sb.from("accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async isAccountUsed(id) {
      const { count, error } = await sb
        .from("journal_lines")
        .select("id", { count: "exact", head: true })
        .eq("account_id", id);
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },

    async listJournalEntries() {
      const [entries, lines] = await Promise.all([
        fetchAll(sb, "journal_entries"),
        fetchAll(sb, "journal_lines"),
      ]);
      return entriesFromRows(entries, lines);
    },

    async insertJournalEntry(e: JournalEntry) {
      const { error: e1 } = await sb.from("journal_entries").insert({
        id: e.id,
        date: e.date,
        description: e.description,
        reference: e.reference ?? null,
        is_reversal: e.isReversal,
        reversed_entry_id: e.reversedEntryId ?? null,
        created_at: e.createdAt,
      });
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await sb.from("journal_lines").insert(
        e.lines.map((l) => ({
          id: l.id,
          journal_entry_id: e.id,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description ?? null,
          created_at: e.createdAt,
        }))
      );
      if (e2) {
        // No transactions over the REST API: undo the header row.
        await sb.from("journal_entries").delete().eq("id", e.id);
        throw new Error(e2.message);
      }
    },

    async deleteJournalEntries(ids) {
      if (ids.length === 0) return;
      // journal_lines rows go with them via ON DELETE CASCADE.
      const { error } = await sb.from("journal_entries").delete().in("id", ids);
      if (error) throw new Error(error.message);
    },

    async resetAll() {
      for (const t of ["journal_lines", "journal_entries", "accounts"]) {
        const { error } = await sb.from(t).delete().neq("id", NIL_UUID);
        if (error) throw new Error(error.message);
      }
    },
  };
}

export async function checkSupabase(s: SupabaseSettings): Promise<ConnectionCheck> {
  try {
    const sb = client(s);
    const probes: [string, string][] = [
      ["accounts", "id, description"],
      ["journal_entries", "id"],
      ["journal_lines", "id"],
    ];
    for (const [table, cols] of probes) {
      const { error, status } = await sb.from(table).select(cols).limit(1);
      if (!error) continue;
      if (!status) {
        return {
          ok: false,
          schemaReady: false,
          message: `Could not reach Supabase at ${s.url}. Check the project URL and your internet connection.`,
        };
      }
      if (status === 401 || status === 403 || /api key|jwt/i.test(error.message)) {
        return { ok: false, schemaReady: false, message: `Supabase rejected the key: ${error.message}` };
      }
      const missing =
        ["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code ?? "") ||
        /does not exist|could not find/i.test(error.message);
      if (missing) {
        return {
          ok: true,
          schemaReady: false,
          message: `Connected, but the database tables are missing or outdated (${error.message}). Run the schema SQL in the Supabase SQL editor.`,
        };
      }
      return { ok: false, schemaReady: false, message: error.message };
    }
    return { ok: true, schemaReady: true, message: "Connected to Supabase. Tables are ready." };
  } catch (err) {
    return {
      ok: false,
      schemaReady: false,
      message: `Could not reach Supabase: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
