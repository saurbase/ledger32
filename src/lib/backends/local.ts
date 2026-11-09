import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/config";
import type { Account, JournalEntry, NewAccount } from "@/lib/types";
import type { Backend } from "./types";

// Local JSON-file store: <data dir>/ledger.json. The Electron desktop app sets
// LEDGER_DATA_DIR to the OS user-data folder so the packaged app can persist
// data outside its read-only bundle.
const LOCAL_PATH = path.join(DATA_DIR, "ledger.json");

interface LocalDB {
  accounts: Account[];
  journalEntries: JournalEntry[];
}

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

export function createLocalBackend(): Backend {
  return {
    kind: "local",

    async listAccounts() {
      return (await readLocal()).accounts;
    },

    async insertAccount(account) {
      const db = await readLocal();
      db.accounts.push(account);
      await writeLocal(db);
      return account;
    },

    async updateAccount(id, patch: Partial<NewAccount>) {
      const db = await readLocal();
      const idx = db.accounts.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Account not found");
      const prev = db.accounts[idx];
      const next: Account = { ...prev };
      if (patch.code !== undefined) next.code = patch.code;
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.type !== undefined) next.type = patch.type;
      if (patch.subtype !== undefined) next.subtype = patch.subtype;
      if (patch.description !== undefined) next.description = patch.description;
      db.accounts[idx] = next;
      await writeLocal(db);
      return next;
    },

    async deleteAccount(id) {
      const db = await readLocal();
      db.accounts = db.accounts.filter((a) => a.id !== id);
      await writeLocal(db);
    },

    async isAccountUsed(id) {
      const db = await readLocal();
      return db.journalEntries.some((e) => e.lines.some((l) => l.accountId === id));
    },

    async listJournalEntries() {
      return (await readLocal()).journalEntries;
    },

    async insertJournalEntry(entry) {
      const db = await readLocal();
      db.journalEntries.push(entry);
      await writeLocal(db);
    },

    async deleteJournalEntries(ids) {
      const set = new Set(ids);
      const db = await readLocal();
      db.journalEntries = db.journalEntries.filter((e) => !set.has(e.id));
      await writeLocal(db);
    },

    async resetAll() {
      await writeLocal({ accounts: [], journalEntries: [] });
    },
  };
}
