import { store } from "@/lib/store";
import {
  balanceSheet,
  generalLedger,
  incomeStatement,
  totalsByType,
  trialBalance,
} from "@/lib/reports";
import { fail, handle, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  return handle(async () => {
    const { type } = await params;
    const [accounts, entries] = await Promise.all([
      store.listAccounts(),
      store.listJournalEntries(),
    ]);

    switch (type) {
      case "trial-balance":
        return ok({
          rows: trialBalance(accounts, entries),
          totalDebit: 0,
          totalCredit: 0,
          generatedAt: new Date().toISOString(),
        });
      case "general-ledger":
        return ok({
          ledgers: generalLedger(accounts, entries),
          generatedAt: new Date().toISOString(),
        });
      case "income-statement":
        return ok({
          ...incomeStatement(accounts, entries),
          generatedAt: new Date().toISOString(),
        });
      case "balance-sheet":
        return ok({
          ...balanceSheet(accounts, entries),
          generatedAt: new Date().toISOString(),
        });
      case "summary":
        return ok({
          totalsByType: totalsByType(accounts, entries),
          accountCount: accounts.length,
          entryCount: entries.length,
          generatedAt: new Date().toISOString(),
        });
      default:
        return fail(`Unknown report type: ${type}`, 404);
    }
  });
}
