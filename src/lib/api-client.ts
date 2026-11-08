import type {
  Account,
  BalanceSheet,
  IncomeStatement,
  JournalEntry,
  NewAccount,
  NewJournalEntry,
} from "@/lib/types";

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

  // Journal
  listJournal: () => request<JournalEntry[]>("/api/journal"),
  createJournal: (input: NewJournalEntry) =>
    request<JournalEntry>("/api/journal", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteJournal: (id: string) =>
    request<{ deleted: boolean }>(`/api/journal/${id}`, { method: "DELETE" }),
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
  status: () =>
    request<{ usingSupabase: boolean; timestamp: string }>("/api/status"),
};
