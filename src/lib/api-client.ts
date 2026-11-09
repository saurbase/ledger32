import type {
  BackendKind,
  ConfigSource,
  DataSourceConfig,
  MaskedConfig,
} from "@/lib/config";
import type { ConnectionCheck } from "@/lib/backends/types";
import type {
  Account,
  AccountImportResult,
  ImportJournalEntry,
  JournalImportResult,
  BalanceSheet,
  IncomeStatement,
  JournalEntry,
  NewAccount,
  NewJournalEntry,
} from "@/lib/types";

export type { BackendKind, ConfigSource, ConnectionCheck, MaskedConfig };

/** Data-source settings sent from the Settings form (empty secret = keep stored). */
export type DataSourceInput = DataSourceConfig;

export interface StatusResponse {
  backend: BackendKind;
  source: ConfigSource;
  usingSupabase: boolean;
  timestamp: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as any).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  // Accounts
  listAccounts: () => request<Account[]>("/api/accounts"),
  createAccount: (input: NewAccount) =>
    request<Account>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateAccount: (id: string, input: Partial<NewAccount>) =>
    request<Account>(`/api/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteAccount: (id: string) =>
    request<{ deleted: boolean }>(`/api/accounts/${id}`, { method: "DELETE" }),
  importAccounts: (accounts: NewAccount[], mode: "update" | "skip") =>
    request<AccountImportResult>("/api/accounts/import", {
      method: "POST",
      body: JSON.stringify({ accounts, mode }),
    }),

  // Journal
  listJournal: () => request<JournalEntry[]>("/api/journal"),
  createJournal: (input: NewJournalEntry) =>
    request<JournalEntry>("/api/journal", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteJournal: (id: string) =>
    request<{ deleted: boolean }>(`/api/journal/${id}`, { method: "DELETE" }),
  importJournal: (entries: ImportJournalEntry[], skipDuplicates: boolean) =>
    request<JournalImportResult>("/api/journal/import", {
      method: "POST",
      body: JSON.stringify({ entries, skipDuplicates }),
    }),
  reverseJournal: (id: string) =>
    request<JournalEntry>(`/api/journal/${id}/reverse`, { method: "POST" }),

  // Reports
  trialBalance: () =>
    request<{
      rows: {
        account: Account;
        debit: number;
        credit: number;
      }[];
      generatedAt: string;
    }>("/api/reports/trial-balance"),
  generalLedger: () =>
    request<{ ledgers: any[]; generatedAt: string }>(
      "/api/reports/general-ledger"
    ),
  incomeStatement: () =>
    request<IncomeStatement & { generatedAt: string }>(
      "/api/reports/income-statement"
    ),
  balanceSheet: () =>
    request<BalanceSheet & { generatedAt: string }>(
      "/api/reports/balance-sheet"
    ),
  summary: () =>
    request<{
      totalsByType: Record<string, number>;
      accountCount: number;
      entryCount: number;
      generatedAt: string;
    }>("/api/reports/summary"),

  // Bulk
  reset: () => request<{ reset: boolean }>("/api/reset", { method: "POST" }),
  seed: () => request<{ seeded: boolean }>("/api/seed", { method: "POST" }),
  status: () => request<StatusResponse>("/api/status"),

  // Data source settings
  getDataSource: () =>
    request<{ config: MaskedConfig; source: ConfigSource }>(
      "/api/settings/datasource"
    ),
  testDataSource: (input: DataSourceInput) =>
    request<ConnectionCheck>("/api/settings/datasource/test", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  initDataSourceSchema: (input: DataSourceInput) =>
    request<ConnectionCheck>("/api/settings/datasource/init-schema", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveDataSource: (input: DataSourceInput) =>
    request<{ backend: BackendKind; source: ConfigSource; message: string }>(
      "/api/settings/datasource",
      { method: "PUT", body: JSON.stringify(input) }
    ),
};
