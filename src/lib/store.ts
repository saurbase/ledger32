import { promises as fs } from "fs";
import path from "path";
import { getSupabase } from "@/lib/supabase-server";
import {
  Account,
  JournalEntry,
  JournalLine,
  NewAccount,
  NewJournalEntry,
  round2,
} from "@/lib/types";

// =========================================================================
// Public store API. Each function transparently routes to Supabase when it
// is configured, otherwise to a local JSON-file store so the app works in the
// sandbox without credentials.
// =========================================================================

export const store = {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccount,
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  deleteJournalEntry,
  reverseJournalEntry,
  resetAll,
  seedSampleData,
  isUsingSupabase,
};

function isUsingSupabase(): boolean {
  return getSupabase() !== null;
}

// ---- Accounts ------------------------------------------------------------

async function listAccounts(): Promise<Account[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("accounts")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToAccount);
  }
  const local = await readLocal();
  return [...local.accounts].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
}

async function getAccount(id: string): Promise<Account | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToAccount(data) : null;
  }
  const local = await readLocal();
  return local.accounts.find((a) => a.id === id) ?? null;
}

async function createAccount(input: NewAccount): Promise<Account> {
  validateAccountInput(input);
  await ensureUniqueCode(input.code);
  const sb = getSupabase();
  if (sb) {
    const row = {
      code: input.code,
      name: input.name,
      type: input.type,
      subtype: input.subtype ?? null,
    };
    const { data, error } = await sb
      .from("accounts")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToAccount(data);
  }
  const local = await readLocal();
  const account: Account = {
    id: uuid(),
    code: input.code,
    name: input.name,
    type: input.type,
    subtype: input.subtype ?? null,
    createdAt: new Date().toISOString(),
  };
  local.accounts.push(account);
  await writeLocal(local);
  return account;
}

async function updateAccount(
  id: string,
  input: Partial<NewAccount>
): Promise<Account> {
  if (input.code !== undefined) await ensureUniqueCode(input.code, id);
  const sb = getSupabase();
  if (sb) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.code !== undefined) row.code = input.code;
    if (input.name !== undefined) row.name = input.name;
    if (input.type !== undefined) row.type = input.type;
    if (input.subtype !== undefined) row.subtype = input.subtype ?? null;
    const { data, error } = await sb
      .from("accounts")
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToAccount(data);
  }
  const local = await readLocal();
  const idx = local.accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Account not found");
  local.accounts[idx] = {
    ...local.accounts[idx],
    ...input,
    subtype: input.subtype ?? local.accounts[idx].subtype,
  };
  await writeLocal(local);
  return local.accounts[idx];
}

async function deleteAccount(id: string): Promise<void> {
  // Prevent deleting an account that is referenced by journal lines.
  const used = await isAccountUsed(id);
  if (used)
    throw new Error(
      "Cannot delete an account that is referenced by journal entries. Remove the entries first."
    );
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("accounts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const local = await readLocal();
  local.accounts = local.accounts.filter((a) => a.id !== id);
  await writeLocal(local);
}

// ---- Journal entries -----------------------------------------------------

async function listJournalEntries(): Promise<JournalEntry[]> {
  const sb = getSupabase();
  if (sb) {
    const [{ data: entries, error: e1 }, { data: lines, error: e2 }] =
      await Promise.all([
        sb.from("journal_entries").select("*"),
        sb.from("journal_lines").select("*"),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    const reversedIds = new Set(
      (entries ?? [])
        .filter((e: any) => e.is_reversal && e.reversed_entry_id)
        .map((e: any) => e.reversed_entry_id)
    );
    return (entries ?? [])
      .map((e: any) => entryFromRows(e, lines ?? [], reversedIds))
      .sort(entrySortFn);
  }
  const local = await readLocal();
  const reversedIds = new Set(
    local.journalEntries
      .filter((e) => e.isReversal && e.reversedEntryId)
      .map((e) => e.reversedEntryId!)
  );
  return local.journalEntries
    .map((e) => ({
      ...e,
      isReversed: reversedIds.has(e.id),
      lines: [...e.lines].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort(entrySortFn);
}

async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const all = await listJournalEntries();
  return all.find((e) => e.id === id) ?? null;
}

async function createJournalEntry(
  input: NewJournalEntry
): Promise<JournalEntry> {
  validateJournalInput(input);

  const entryId = uuid();
  const now = new Date().toISOString();
  const lines: JournalLine[] = input.lines.map((l) => ({
    id: uuid(),
    accountId: l.accountId,
    debit: round2(l.debit || 0),
    credit: round2(l.credit || 0),
    description: l.description ?? null,
  }));

  const sb = getSupabase();
  if (sb) {
    const entryRow = {
      id: entryId,
      date: input.date,
      description: input.description,
      reference: input.reference ?? null,
      is_reversal: false,
      reversed_entry_id: null,
      created_at: now,
    };
    const { error: e1 } = await sb.from("journal_entries").insert(entryRow);
    if (e1) throw new Error(e1.message);
    const lineRows = lines.map((l) => ({
      id: l.id,
      journal_entry_id: entryId,
      account_id: l.accountId,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
      created_at: now,
    }));
    const { error: e2 } = await sb.from("journal_lines").insert(lineRows);
    if (e2) throw new Error(e2.message);
    return {
      id: entryId,
      date: input.date,
      description: input.description,
      reference: input.reference ?? null,
      isReversal: false,
      reversedEntryId: null,
      isReversed: false,
      lines,
      createdAt: now,
    };
  }

  const local = await readLocal();
  const entry: JournalEntry = {
    id: entryId,
    date: input.date,
    description: input.description,
    reference: input.reference ?? null,
    isReversal: false,
    reversedEntryId: null,
    isReversed: false,
    lines,
    createdAt: now,
  };
  local.journalEntries.push(entry);
  await writeLocal(local);
  return entry;
}

async function deleteJournalEntry(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    // If this entry is a reversal, simply delete it (the original stays).
    // If this entry was reversed, also delete its reversal entry.
    const { data: reversals } = await sb
      .from("journal_entries")
      .select("id")
      .eq("reversed_entry_id", id);
    const reversalIds = (reversals ?? []).map((r: any) => r.id);
    const toDelete = [id, ...reversalIds];
    if (reversalIds.length) {
      await sb.from("journal_lines").in("journal_entry_id", reversalIds).delete();
      await sb.from("journal_entries").in("id", reversalIds).delete();
    }
    await sb.from("journal_lines").eq("journal_entry_id", id).delete();
    await sb.from("journal_entries").eq("id", id).delete();
    void toDelete;
    return;
  }
  const local = await readLocal();
  // Also remove any reversal entries that reverse this one.
  const reversalIds = local.journalEntries
    .filter((e) => e.reversedEntryId === id)
    .map((e) => e.id);
  local.journalEntries = local.journalEntries.filter(
    (e) => e.id !== id && !reversalIds.includes(e.id)
  );
  await writeLocal(local);
}

async function reverseJournalEntry(id: string): Promise<JournalEntry> {
  const original = await getJournalEntry(id);
  if (!original) throw new Error("Journal entry not found");
  if (original.isReversal)
    throw new Error("A reversing entry cannot itself be reversed.");
  if (original.isReversed)
    throw new Error("This entry has already been reversed.");

  const reversalId = uuid();
  const now = new Date().toISOString();
  const lines: JournalLine[] = original.lines.map((l) => ({
    id: uuid(),
    accountId: l.accountId,
    // Swap debits and credits.
    debit: round2(l.credit || 0),
    credit: round2(l.debit || 0),
    description: l.description ?? null,
  }));

  const sb = getSupabase();
  if (sb) {
    const entryRow = {
      id: reversalId,
      date: original.date,
      description: `Reversal of: ${original.description}`,
      reference: original.reference ?? null,
      is_reversal: true,
      reversed_entry_id: id,
      created_at: now,
    };
    const { error: e1 } = await sb.from("journal_entries").insert(entryRow);
    if (e1) throw new Error(e1.message);
    const lineRows = lines.map((l) => ({
      id: l.id,
      journal_entry_id: reversalId,
      account_id: l.accountId,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
      created_at: now,
    }));
    const { error: e2 } = await sb.from("journal_lines").insert(lineRows);
    if (e2) throw new Error(e2.message);
    return {
      id: reversalId,
      date: original.date,
      description: `Reversal of: ${original.description}`,
      reference: original.reference ?? null,
      isReversal: true,
      reversedEntryId: id,
      isReversed: false,
      lines,
      createdAt: now,
    };
  }

  const local = await readLocal();
  const reversal: JournalEntry = {
    id: reversalId,
    date: original.date,
    description: `Reversal of: ${original.description}`,
    reference: original.reference ?? null,
    isReversal: true,
    reversedEntryId: id,
    isReversed: false,
    lines,
    createdAt: now,
  };
  local.journalEntries.push(reversal);
  await writeLocal(local);
  return reversal;
}

// ---- Bulk operations -----------------------------------------------------

async function resetAll(): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("journal_lines").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("journal_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return;
  }
  await writeLocal({ accounts: [], journalEntries: [] });
}

async function seedSampleData(): Promise<void> {
  // Idempotent-ish: wipe then seed a standard chart of accounts + sample entry.
  await resetAll();

  const accounts: NewAccount[] = [
    // Assets (1000s)
    { code: "1010", name: "Cash", type: "asset", subtype: "Current Asset" },
    { code: "1020", name: "Bank Account", type: "asset", subtype: "Current Asset" },
    { code: "1200", name: "Accounts Receivable", type: "asset", subtype: "Current Asset" },
    { code: "1500", name: "Office Equipment", type: "asset", subtype: "Fixed Asset" },
    // Liabilities (2000s)
    { code: "2010", name: "Accounts Payable", type: "liability", subtype: "Current Liability" },
    { code: "2100", name: "Sales Tax Payable", type: "liability", subtype: "Current Liability" },
    // Equity (3000s)
    { code: "3010", name: "Owner's Capital", type: "equity" },
    { code: "3020", name: "Retained Earnings", type: "equity" },
    // Revenue (4000s)
    { code: "4010", name: "Sales Revenue", type: "revenue" },
    { code: "4020", name: "Service Revenue", type: "revenue" },
    // Expenses (5000s)
    { code: "5010", name: "Cost of Goods Sold", type: "expense" },
    { code: "5100", name: "Rent Expense", type: "expense" },
    { code: "5200", name: "Salaries Expense", type: "expense" },
    { code: "5300", name: "Utilities Expense", type: "expense" },
    { code: "5400", name: "Office Supplies", type: "expense" },
  ];

  const created: Account[] = [];
  for (const a of accounts) created.push(await createAccount(a));

  const byCode = (code: string) => created.find((a) => a.code === code)!;
  const today = new Date().toISOString().slice(0, 10);

  // Owner invests capital into bank.
  await createJournalEntry({
    date: today,
    description: "Owner capital contribution",
    reference: "INV-001",
    lines: [
      { accountId: byCode("1020").id, debit: 10000, credit: 0 },
      { accountId: byCode("3010").id, debit: 0, credit: 10000 },
    ],
  });

  // Purchase office equipment with cash.
  await createJournalEntry({
    date: today,
    description: "Purchase office equipment",
    reference: "AP-001",
    lines: [
      { accountId: byCode("1500").id, debit: 2500, credit: 0 },
      { accountId: byCode("2010").id, debit: 0, credit: 2500 },
    ],
  });

  // Record a cash sale.
  await createJournalEntry({
    date: today,
    description: "Cash sale to customer",
    reference: "SALE-001",
    lines: [
      { accountId: byCode("1020").id, debit: 1200, credit: 0 },
      { accountId: byCode("4010").id, debit: 0, credit: 1200 },
    ],
  });
}

// ---- Validation helpers --------------------------------------------------

function validateAccountInput(input: NewAccount) {
  if (!input.code?.trim()) throw new Error("Account code is required");
  if (!input.name?.trim()) throw new Error("Account name is required");
  if (!["asset", "liability", "equity", "revenue", "expense"].includes(input.type))
    throw new Error("Invalid account type");
}

async function ensureUniqueCode(code: string, exceptId?: string) {
  const accounts = await listAccounts();
  const clash = accounts.find(
    (a) => a.code.toLowerCase() === code.toLowerCase() && a.id !== exceptId
  );
  if (clash) throw new Error(`Account code "${code}" already exists`);
}

function validateJournalInput(input: NewJournalEntry) {
  if (!input.date) throw new Error("Date is required");
  if (!input.description?.trim()) throw new Error("Description is required");
  if (!Array.isArray(input.lines) || input.lines.length < 2)
    throw new Error("A journal entry requires at least two lines");

  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of input.lines) {
    if (!l.accountId) throw new Error("Every line needs an account");
    const d = round2(l.debit || 0);
    const c = round2(l.credit || 0);
    if (d < 0 || c < 0) throw new Error("Debit and credit must be non-negative");
    if (d > 0 && c > 0) throw new Error("A line cannot have both debit and credit");
    if (d === 0 && c === 0) throw new Error("A line must have a non-zero debit or credit");
    totalDebit += d;
    totalCredit += c;
  }
  if (round2(totalDebit) !== round2(totalCredit))
    throw new Error(
      `Entry is not balanced. Debits ${round2(totalDebit).toFixed(2)} ≠ Credits ${round2(
        totalCredit
      ).toFixed(2)}`
    );
}

async function isAccountUsed(accountId: string): Promise<boolean> {
  const sb = getSupabase();
  if (sb) {
    const { count } = await sb
      .from("journal_lines")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId);
    return (count ?? 0) > 0;
  }
  const local = await readLocal();
  return local.journalEntries.some((e) =>
    e.lines.some((l) => l.accountId === accountId)
  );
}

// ---- Local JSON-file store ----------------------------------------------

interface LocalDB {
  accounts: Account[];
  journalEntries: JournalEntry[];
}

// The local JSON store path. Defaults to <cwd>/data/ledger.json. The Electron
// desktop app sets LEDGER_DATA_DIR to the OS user-data folder so the packaged
// app can persist data outside its read-only bundle.
const LOCAL_PATH = path.join(
  process.env.LEDGER_DATA_DIR || path.join(process.cwd(), "data"),
  "ledger.json"
);

async function readLocal(): Promise<LocalDB> {
  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf-8");
    const parsed = JSON.parse(raw) as LocalDB;
    return {
      accounts: parsed.accounts ?? [],
      journalEntries: parsed.journalEntries ?? [],
    };
  } catch {
    return { accounts: [], journalEntries: [] };
  }
}

async function writeLocal(db: LocalDB): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// ---- Row mappers ---------------------------------------------------------

function rowToAccount(r: any): Account {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    subtype: r.subtype ?? null,
    createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
  };
}

function entryFromRows(e: any, lines: any[], reversedIds: Set<string>): JournalEntry {
  const entryLines = lines
    .filter((l) => l.journal_entry_id === e.id)
    .map((l) => ({
      id: l.id,
      accountId: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    id: e.id,
    date: e.date,
    description: e.description,
    reference: e.reference ?? null,
    isReversal: !!e.is_reversal,
    reversedEntryId: e.reversed_entry_id ?? null,
    isReversed: reversedIds.has(e.id),
    lines: entryLines,
    createdAt: e.created_at ?? new Date().toISOString(),
  };
}

function entrySortFn(a: JournalEntry, b: JournalEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

function uuid(): string {
  // crypto.randomUUID is available in Node 19+ and modern browsers.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
