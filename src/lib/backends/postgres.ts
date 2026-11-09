import { Pool, types as pgTypes, type PoolConfig } from "pg";
import type { PostgresSettings } from "@/lib/config";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import type { Account, JournalEntry, NewAccount } from "@/lib/types";
import { accountFromRow, entriesFromRows } from "./rows";
import type { Backend, ConnectionCheck } from "./types";

const DATE_OID = 1082;

function poolConfig(s: PostgresSettings): PoolConfig {
  return {
    host: s.host,
    port: s.port,
    database: s.database,
    user: s.user,
    password: s.password,
    // Hosted Postgres (Supabase, Neon, RDS, …) usually requires TLS. The
    // server certificate is not verified, matching `sslmode=require`.
    ssl: s.ssl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    // Return DATE columns as plain yyyy-mm-dd strings (no timezone shifts).
    types: {
      getTypeParser: ((oid: number, format?: any) =>
        oid === DATE_OID
          ? (v: string) => v
          : pgTypes.getTypeParser(oid, format)) as any,
    },
  };
}

export function createPostgresBackend(settings: PostgresSettings): Backend {
  const pool = new Pool(poolConfig(settings));
  // An idle client erroring (e.g. server restart) must not crash the process.
  pool.on("error", (err) => console.error("[postgres] idle client error:", err.message));

  const q = (text: string, values?: unknown[]) => pool.query(text, values);

  return {
    kind: "postgres",

    async listAccounts() {
      const { rows } = await q("select * from public.accounts");
      return rows.map(accountFromRow);
    },

    async insertAccount(a: Account) {
      const { rows } = await q(
        `insert into public.accounts (id, code, name, type, subtype, description, created_at)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [a.id, a.code, a.name, a.type, a.subtype ?? null, a.description ?? null, a.createdAt]
      );
      return accountFromRow(rows[0]);
    },

    async updateAccount(id, patch: Partial<NewAccount>) {
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const k of ["code", "name", "type", "subtype", "description"] as const) {
        if (patch[k] !== undefined) {
          values.push(patch[k] ?? null);
          sets.push(`${k} = $${values.length}`);
        }
      }
      sets.push("updated_at = now()");
      values.push(id);
      const { rows } = await q(
        `update public.accounts set ${sets.join(", ")} where id = $${values.length} returning *`,
        values
      );
      if (!rows[0]) throw new Error("Account not found");
      return accountFromRow(rows[0]);
    },

    async deleteAccount(id) {
      await q("delete from public.accounts where id = $1", [id]);
    },

    async isAccountUsed(id) {
      const { rows } = await q(
        "select exists(select 1 from public.journal_lines where account_id = $1) as used",
        [id]
      );
      return !!rows[0]?.used;
    },

    async listJournalEntries() {
      const [entries, lines] = await Promise.all([
        q("select * from public.journal_entries"),
        q("select * from public.journal_lines"),
      ]);
      return entriesFromRows(entries.rows, lines.rows);
    },

    async insertJournalEntry(e: JournalEntry) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query(
          `insert into public.journal_entries
             (id, date, description, reference, is_reversal, reversed_entry_id, created_at)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [e.id, e.date, e.description, e.reference ?? null, e.isReversal, e.reversedEntryId ?? null, e.createdAt]
        );
        for (const l of e.lines) {
          await c.query(
            `insert into public.journal_lines
               (id, journal_entry_id, account_id, debit, credit, description, created_at)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [l.id, e.id, l.accountId, l.debit, l.credit, l.description ?? null, e.createdAt]
          );
        }
        await c.query("commit");
      } catch (err) {
        await c.query("rollback").catch(() => {});
        throw err;
      } finally {
        c.release();
      }
    },

    async deleteJournalEntries(ids) {
      if (ids.length === 0) return;
      // journal_lines rows go with them via ON DELETE CASCADE.
      await q("delete from public.journal_entries where id = any($1::uuid[])", [ids]);
    },

    async resetAll() {
      await q("truncate public.journal_lines, public.journal_entries, public.accounts");
    },

    async close() {
      await pool.end();
    },
  };
}

/** Run a callback with a short-lived single connection. */
async function withPool<T>(s: PostgresSettings, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ ...poolConfig(s), max: 1 });
  pool.on("error", () => {});
  try {
    return await fn(pool);
  } finally {
    await pool.end().catch(() => {});
  }
}

export async function checkPostgres(s: PostgresSettings): Promise<ConnectionCheck> {
  try {
    return await withPool(s, async (pool) => {
      const { rows } = await pool.query(
        `select
           to_regclass('public.accounts') is not null as accounts,
           to_regclass('public.journal_entries') is not null as entries,
           to_regclass('public.journal_lines') is not null as lines,
           exists (
             select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'accounts'
               and column_name = 'description'
           ) as has_description,
           current_setting('server_version') as version`
      );
      const r = rows[0];
      const ready = r.accounts && r.entries && r.lines && r.has_description;
      return {
        ok: true,
        schemaReady: !!ready,
        message: ready
          ? `Connected to PostgreSQL ${r.version}. Tables are ready.`
          : `Connected to PostgreSQL ${r.version}, but the Ledger tables are missing or outdated. Use "Create tables" to set them up.`,
      };
    });
  } catch (err) {
    return {
      ok: false,
      schemaReady: false,
      message: `Could not connect: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Create (or upgrade) the Ledger tables. Safe to run repeatedly. */
export async function initPostgresSchema(s: PostgresSettings): Promise<void> {
  await withPool(s, async (pool) => {
    // Only needed for gen_random_uuid() on PostgreSQL < 13; managed hosts may
    // not allow creating extensions, so ignore failures here.
    await pool.query("create extension if not exists pgcrypto").catch(() => {});
    await pool.query(SCHEMA_SQL);
  });
}
