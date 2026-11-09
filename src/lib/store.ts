import { getBackend, getBackendInfo } from "@/lib/backends";
import {
  Account,
  AccountImportResult,
  JournalEntry,
  JournalLine,
  NewAccount,
  NewJournalEntry,
  round2,
} from "@/lib/types";

// =========================================================================
// Public store API: the business rules of the ledger (validation, balancing,
// reversals, unique codes, seeding, import). Storage is delegated to the
// active backend (local JSON file, Supabase or PostgreSQL), which is chosen in
// Settings → Data source. See src/lib/backends/.
// =========================================================================

export const store = {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  importAccounts,
  getAccount,
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  deleteJournalEntry,
  reverseJournalEntry,
  resetAll,
  seedSampleData,
  getStatus,
};

async function getStatus() {
  const { backend, source } = await getBackendInfo();
  return { backend: backend.kind, source };
}

// ---- Accounts ------------------------------------------------------------

async function listAccounts(): Promise<Account[]> {
  const accounts = await (await getBackend()).listAccounts();
  return accounts.sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
}

async function getAccount(id: string): Promise<Account | null> {
  const accounts = await (await getBackend()).listAccounts();
  return accounts.find((a) => a.id === id) ?? null;
}

async function createAccount(input: NewAccount): Promise<Account> {
  validateAccountInput(input);
  await ensureUniqueCode(input.code);
  return (await getBackend()).insertAccount({
    id: uuid(),
    code: input.code,
    name: input.name,
    type: input.type,
    subtype: input.subtype ?? null,
    description: input.description ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function updateAccount(
  id: string,
  input: Partial<NewAccount>
): Promise<Account> {
  if (input.code !== undefined) {
    if (!input.code.trim()) throw new Error("Account code is required");
    await ensureUniqueCode(input.code, id);
  }
  if (input.name !== undefined && !input.name.trim())
    throw new Error("Account name is required");
  if (input.type !== undefined && !ACCOUNT_TYPE_SET.has(input.type))
    throw new Error("Invalid account type");
  return (await getBackend()).updateAccount(id, input);
}

async function deleteAccount(id: string): Promise<void> {
  const backend = await getBackend();
  // Prevent deleting an account that is referenced by journal lines.
  if (await backend.isAccountUsed(id))
    throw new Error(
      "Cannot delete an account that is referenced by journal entries. Remove the entries first."
    );
  await backend.deleteAccount(id);
}

/**
 * Bulk-import accounts (e.g. from a CSV file). Rows are matched to existing
 * accounts by code (case-insensitive). With mode "update" matching accounts
 * are overwritten; with "skip" they are left untouched. Each row is processed
 * independently so one bad row doesn't abort the whole import.
 */
async function importAccounts(
  rows: NewAccount[],
  mode: "update" | "skip" = "update"
): Promise<AccountImportResult> {
  const result: AccountImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const existing = await listAccounts();
  const byCode = new Map(existing.map((a) => [a.code.toLowerCase(), a]));
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 1;
    const raw = rows[i] ?? ({} as NewAccount);
    const input: NewAccount = {
      code: String(raw.code ?? "").trim(),
      name: String(raw.name ?? "").trim(),
      type: String(raw.type ?? "").trim().toLowerCase() as NewAccount["type"],
      subtype: raw.subtype ? String(raw.subtype).trim() || null : null,
      description: raw.description
        ? String(raw.description).trim() || null
        : null,
    };
    try {
      validateAccountInput(input);
      const key = input.code.toLowerCase();
      if (seen.has(key))
        throw new Error(`Duplicate code "${input.code}" in the import file`);
      seen.add(key);

      const match = byCode.get(key);
      if (match) {
        if (mode === "skip") {
          result.skipped++;
          continue;
        }
        await updateAccount(match.id, input);
        result.updated++;
      } else {
        const created = await createAccount(input);
        byCode.set(key, created);
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        row: rowNo,
        code: input.code || undefined,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

// ---- Journal entries -----------------------------------------------------

async function listJournalEntries(): Promise<JournalEntry[]> {
  const entries = await (await getBackend()).listJournalEntries();
  const reversedIds = new Set(
    entries
      .filter((e) => e.isReversal && e.reversedEntryId)
      .map((e) => e.reversedEntryId!)
  );
  return entries
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
  const entry: JournalEntry = {
    id: uuid(),
    date: input.date,
    description: input.description,
    reference: input.reference ?? null,
    isReversal: false,
    reversedEntryId: null,
    isReversed: false,
    lines: input.lines.map((l) => ({
      id: uuid(),
      accountId: l.accountId,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
      description: l.description ?? null,
    })),
    createdAt: new Date().toISOString(),
  };
  await (await getBackend()).insertJournalEntry(entry);
  return entry;
}

async function deleteJournalEntry(id: string): Promise<void> {
  const backend = await getBackend();
  const entries = await backend.listJournalEntries();
  if (!entries.some((e) => e.id === id))
    throw new Error("Journal entry not found");
  // Deleting an entry also removes any reversal entries that reverse it.
  const reversalIds = entries
    .filter((e) => e.reversedEntryId === id)
    .map((e) => e.id);
  await backend.deleteJournalEntries([...reversalIds, id]);
}

async function reverseJournalEntry(id: string): Promise<JournalEntry> {
  const original = await getJournalEntry(id);
  if (!original) throw new Error("Journal entry not found");
  if (original.isReversal)
    throw new Error("A reversing entry cannot itself be reversed.");
  if (original.isReversed)
    throw new Error("This entry has already been reversed.");

  const lines: JournalLine[] = original.lines.map((l) => ({
    id: uuid(),
    accountId: l.accountId,
    // Swap debits and credits.
    debit: round2(l.credit || 0),
    credit: round2(l.debit || 0),
    description: l.description ?? null,
  }));
  const reversal: JournalEntry = {
    id: uuid(),
    date: original.date,
    description: `Reversal of: ${original.description}`,
    reference: original.reference ?? null,
    isReversal: true,
    reversedEntryId: id,
    isReversed: false,
    lines,
    createdAt: new Date().toISOString(),
  };
  await (await getBackend()).insertJournalEntry(reversal);
  return reversal;
}

// ---- Bulk operations -----------------------------------------------------

async function resetAll(): Promise<void> {
  await (await getBackend()).resetAll();
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

  // Purchase office equipment on credit.
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

const ACCOUNT_TYPE_SET = new Set([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

function validateAccountInput(input: NewAccount) {
  if (!input.code?.trim()) throw new Error("Account code is required");
  if (!input.name?.trim()) throw new Error("Account name is required");
  if (!ACCOUNT_TYPE_SET.has(input.type)) throw new Error("Invalid account type");
}

async function ensureUniqueCode(code: string, exceptId?: string) {
  const accounts = await (await getBackend()).listAccounts();
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

// ---- Misc ------------------------------------------------------------------

function entrySortFn(a: JournalEntry, b: JournalEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

function uuid(): string {
  // Real UUIDs are required by the Supabase/PostgreSQL `uuid` columns.
  return globalThis.crypto.randomUUID();
}
