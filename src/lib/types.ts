// Shared domain types for the double-entry bookkeeping app.

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export const ACCOUNT_TYPES: AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

/** Accounts whose normal balance is a debit. */
export const DEBIT_NORMAL: AccountType[] = ["asset", "expense"];
/** Accounts whose normal balance is a credit. */
export const CREDIT_NORMAL: AccountType[] = ["liability", "equity", "revenue"];

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  description: string;
  reference?: string | null;
  /** True if this entry was created as a reversal of another entry. */
  isReversal: boolean;
  /** When this is a reversal, the id of the entry it reverses. */
  reversedEntryId?: string | null;
  /** True if this entry has been reversed (cancelled) by another entry. */
  isReversed: boolean;
  lines: JournalLine[];
  createdAt: string;
}

export interface NewAccount {
  code: string;
  name: string;
  type: AccountType;
  subtype?: string | null;
  description?: string | null;
}

export interface AccountImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; code?: string; error: string }[];
}

export interface NewJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface NewJournalEntry {
  date: string;
  description: string;
  reference?: string | null;
  lines: NewJournalLine[];
}

// ---- Reports ----

export interface AccountBalance {
  account: Account;
  debit: number;
  credit: number;
  /** Signed balance expressed in the account's normal direction. */
  balance: number;
}

export interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
}

export interface LedgerLine {
  date: string;
  description: string;
  reference?: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  entryId: string;
  isReversal: boolean;
}

export interface AccountLedger {
  account: Account;
  openingBalance: number;
  lines: LedgerLine[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

export interface IncomeStatementRow {
  account: Account;
  amount: number;
}

export interface IncomeStatement {
  revenue: IncomeStatementRow[];
  expenses: IncomeStatementRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetRow {
  account: Account;
  amount: number;
}

export interface BalanceSheet {
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netIncome: number;
  /** Assets - (Liabilities + Equity + NetIncome). Should be ~0. */
  balanced: boolean;
}

// ---- Helpers ----

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number): string {
  const r = round2(n);
  const neg = r < 0;
  const abs = Math.abs(r);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${neg ? "(" : ""}${s}${neg ? ")" : ""}`;
}

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
