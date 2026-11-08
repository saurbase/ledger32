import {
  Account,
  AccountLedger,
  BalanceSheet,
  CREDIT_NORMAL,
  DEBIT_NORMAL,
  IncomeStatement,
  JournalEntry,
  round2,
  TrialBalanceRow,
} from "@/lib/types";

/**
 * Compute the signed balance for an account from a list of journal entries.
 * Sign convention: positive = normal-balance direction.
 *  - asset/expense: balance = debit - credit
 *  - liability/equity/revenue: balance = credit - debit
 */
export function accountBalance(
  account: Account,
  entries: JournalEntry[]
): { debit: number; credit: number; balance: number } {
  let debit = 0;
  let credit = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.accountId === account.id) {
        debit += l.debit || 0;
        credit += l.credit || 0;
      }
    }
  }
  debit = round2(debit);
  credit = round2(credit);
  const balance = DEBIT_NORMAL.includes(account.type)
    ? round2(debit - credit)
    : round2(credit - debit);
  return { debit, credit, balance };
}

export function trialBalance(
  accounts: Account[],
  entries: JournalEntry[]
): TrialBalanceRow[] {
  const rows: TrialBalanceRow[] = accounts.map((account) => {
    const { debit, credit } = accountBalance(account, entries);
    const bal = round2(debit - credit);
    // Trial balance lists each account's net effect in the debit or credit column.
    return {
      account,
      debit: bal > 0 ? round2(bal) : 0,
      credit: bal < 0 ? round2(-bal) : 0,
    };
  });
  return rows.filter(
    (r) => round2(r.debit) !== 0 || round2(r.credit) !== 0
  );
}

export function generalLedger(
  accounts: Account[],
  entries: JournalEntry[]
): AccountLedger[] {
  // Sort entries chronologically for running balances.
  const sorted = [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

  return accounts
    .map((account) => {
      const isDebitNormal = DEBIT_NORMAL.includes(account.type);
      let running = 0;
      const lines = [];
      for (const e of sorted) {
        for (const l of e.lines) {
          if (l.accountId !== account.id) continue;
          const d = round2(l.debit || 0);
          const c = round2(l.credit || 0);
          running = round2(running + (isDebitNormal ? d - c : c - d));
          lines.push({
            date: e.date,
            description: e.description,
            reference: e.reference ?? null,
            debit: d,
            credit: c,
            runningBalance: running,
            entryId: e.id,
            isReversal: e.isReversal,
          });
        }
      }
      return {
        account,
        openingBalance: 0,
        closingBalance: running,
        totalDebit: round2(lines.reduce((s, l) => s + l.debit, 0)),
        totalCredit: round2(lines.reduce((s, l) => s + l.credit, 0)),
        lines,
      };
    })
    .filter((l) => l.lines.length > 0);
}

export function incomeStatement(
  accounts: Account[],
  entries: JournalEntry[]
): IncomeStatement {
  const revenue = accounts
    .filter((a) => a.type === "revenue")
    .map((account) => {
      const { balance } = accountBalance(account, entries);
      return { account, amount: round2(balance) };
    })
    .filter((r) => round2(r.amount) !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const expenses = accounts
    .filter((a) => a.type === "expense")
    .map((account) => {
      const { balance } = accountBalance(account, entries);
      return { account, amount: round2(balance) };
    })
    .filter((r) => round2(r.amount) !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const totalRevenue = round2(revenue.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, r) => s + r.amount, 0));
  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: round2(totalRevenue - totalExpenses),
  };
}

export function balanceSheet(
  accounts: Account[],
  entries: JournalEntry[]
): BalanceSheet {
  const assets = accounts
    .filter((a) => a.type === "asset")
    .map((account) => ({ account, amount: accountBalance(account, entries).balance }))
    .filter((r) => round2(r.amount) !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const liabilities = accounts
    .filter((a) => a.type === "liability")
    .map((account) => ({ account, amount: accountBalance(account, entries).balance }))
    .filter((r) => round2(r.amount) !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const equity = accounts
    .filter((a) => a.type === "equity")
    .map((account) => ({ account, amount: accountBalance(account, entries).balance }))
    .filter((r) => round2(r.amount) !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, r) => s + r.amount, 0));
  const { netIncome } = incomeStatement(accounts, entries);
  const totalEquity = round2(
    equity.reduce((s, r) => s + r.amount, 0) + netIncome
  );

  // Balanced check: Assets == Liabilities + Equity (incl. net income)
  const balanced = round2(totalAssets - (totalLiabilities + totalEquity)) === 0;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
    balanced,
  };
}

export function totalsByType(
  accounts: Account[],
  entries: JournalEntry[]
): Record<string, number> {
  const out: Record<string, number> = {
    asset: 0,
    liability: 0,
    equity: 0,
    revenue: 0,
    expense: 0,
  };
  for (const a of accounts) {
    out[a.type] = round2(out[a.type] + accountBalance(a, entries).balance);
  }
  return out;
}

void CREDIT_NORMAL;
