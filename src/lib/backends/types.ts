import type { BackendKind } from "@/lib/config";
import type { Account, JournalEntry, NewAccount } from "@/lib/types";

/**
 * Low-level storage operations. Business rules (validation, balancing,
 * reversals, unique codes, seeding, import) live in `store.ts` and are shared
 * by every backend.
 */
export interface Backend {
  readonly kind: BackendKind;

  listAccounts(): Promise<Account[]>;
  insertAccount(account: Account): Promise<Account>;
  /** Fields set to `undefined` are left unchanged; `null` clears them. */
  updateAccount(id: string, patch: Partial<NewAccount>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  isAccountUsed(id: string): Promise<boolean>;

  /** All entries with their lines. `isReversed` is computed by the store. */
  listJournalEntries(): Promise<JournalEntry[]>;
  insertJournalEntry(entry: JournalEntry): Promise<void>;
  deleteJournalEntries(ids: string[]): Promise<void>;

  resetAll(): Promise<void>;
  /** Release connections (called when switching data source). */
  close?(): Promise<void>;
}

/** Result of testing a connection from Settings. */
export interface ConnectionCheck {
  ok: boolean;
  /** Connected, and the accounts / journal tables exist and are up to date. */
  schemaReady: boolean;
  message: string;
}
