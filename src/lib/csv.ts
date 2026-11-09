import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  round2,
  type Account,
  type AccountType,
  type ImportJournalEntry,
  type JournalEntry,
  type NewAccount,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Generic CSV (RFC 4180) helpers
// ---------------------------------------------------------------------------

/** Characters that make spreadsheet apps treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Guard against CSV/formula injection when the file is opened in Excel.
  if (FORMULA_START.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Parse CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully empty lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Trigger a browser (or Electron) download of text content. */
export function downloadText(filename: string, content: string, mime: string) {
  // Prepend a BOM so Excel opens UTF-8 CSVs with the right encoding.
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Chart of accounts <-> CSV
// ---------------------------------------------------------------------------

export const ACCOUNT_CSV_HEADERS = [
  "Code",
  "Name",
  "Type",
  "Subtype",
  "Description",
] as const;

export function accountsToCsv(accounts: Account[]): string {
  const sorted = [...accounts].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })
  );
  return toCsv([
    [...ACCOUNT_CSV_HEADERS],
    ...sorted.map((a) => [
      a.code,
      a.name,
      a.type,
      a.subtype ?? "",
      a.description ?? "",
    ]),
  ]);
}

export function accountCsvTemplate(): string {
  return toCsv([
    [...ACCOUNT_CSV_HEADERS],
    ["1010", "Cash", "asset", "Current Asset", "Cash on hand and petty cash"],
    ["2010", "Accounts Payable", "liability", "Current Liability", "Amounts owed to suppliers"],
    ["4010", "Sales Revenue", "revenue", "", "Income from product sales"],
  ]);
}

/** Map a header cell to a known field, accepting common variations. */
function headerField(h: string): keyof NewAccount | null {
  const k = h.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["code", "accountcode", "accountno", "accountnumber", "number", "no"].includes(k))
    return "code";
  if (["name", "account", "accountname", "title"].includes(k)) return "name";
  if (["type", "accounttype", "category"].includes(k)) return "type";
  if (["subtype", "accountsubtype", "subcategory", "group"].includes(k))
    return "subtype";
  if (["description", "desc", "notes", "note", "details"].includes(k))
    return "description";
  return null;
}

/** Accept "asset", "Assets", "ASSET", "Expenses", "income" etc. */
export function normalizeAccountType(v: string): AccountType | null {
  const k = v.trim().toLowerCase();
  if (!k) return null;
  for (const t of ACCOUNT_TYPES) {
    if (k === t || k === ACCOUNT_TYPE_LABELS[t].toLowerCase()) return t;
  }
  const aliases: Record<string, AccountType> = {
    assets: "asset",
    liabilities: "liability",
    revenues: "revenue",
    income: "revenue",
    expenses: "expense",
    expenditure: "expense",
    capital: "equity",
  };
  return aliases[k] ?? null;
}

/** Undo the formula-injection guard added on export. */
function unguard(s: string): string {
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

export interface ParsedAccounts {
  accounts: NewAccount[];
  /** 1-based data-row numbers (excluding the header) with problems. */
  errors: { row: number; error: string }[];
}

export function csvToAccounts(text: string): ParsedAccounts {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { accounts: [], errors: [{ row: 0, error: "The file is empty" }] };
  }
  const fields = rows[0].map(headerField);
  for (const required of ["code", "name", "type"] as const) {
    if (!fields.includes(required)) {
      return {
        accounts: [],
        errors: [
          {
            row: 0,
            error: `Missing "${required}" column. Expected headers: ${ACCOUNT_CSV_HEADERS.join(", ")}`,
          },
        ],
      };
    }
  }

  const accounts: NewAccount[] = [];
  const errors: ParsedAccounts["errors"] = [];
  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 1;
    const rec: Record<string, string> = {};
    fields.forEach((f, idx) => {
      if (f) rec[f] = unguard((cells[idx] ?? "").trim());
    });
    const type = normalizeAccountType(rec.type ?? "");
    if (!rec.code) return errors.push({ row: rowNo, error: "Code is empty" });
    if (!rec.name) return errors.push({ row: rowNo, error: "Name is empty" });
    if (!type)
      return errors.push({
        row: rowNo,
        error: `Unknown type "${rec.type ?? ""}" (use asset, liability, equity, revenue or expense)`,
      });
    accounts.push({
      code: rec.code,
      name: rec.name,
      type,
      subtype: rec.subtype || null,
      description: rec.description || null,
    });
  });
  return { accounts, errors };
}

// ---------------------------------------------------------------------------
// Journal entries <-> CSV
//
// One row per journal line. Rows with the same "Entry" value belong to the
// same journal entry; date / reference / description only need to be filled
// on the entry's first row. Accounts are matched by code.
// ---------------------------------------------------------------------------

export const JOURNAL_CSV_HEADERS = [
  "Entry",
  "Date",
  "Reference",
  "Description",
  "Account Code",
  "Account Name",
  "Debit",
  "Credit",
  "Memo",
  "Reversal",
] as const

/** Plain number for CSV: no thousands separators, 2 decimals, blank for 0. */
function csvAmount(n: number): string {
  return n ? n.toFixed(2) : ""
}

export function journalToCsv(entries: JournalEntry[], accounts: Account[]): string {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  // Chronological order reads naturally in a spreadsheet.
  const sorted = [...entries].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1
  )
  const rows: unknown[][] = [[...JOURNAL_CSV_HEADERS]]
  sorted.forEach((e, i) => {
    for (const l of e.lines) {
      const acct = byId.get(l.accountId)
      rows.push([
        i + 1,
        e.date,
        e.reference ?? "",
        e.description,
        acct?.code ?? "",
        acct?.name ?? "(deleted account)",
        csvAmount(l.debit),
        csvAmount(l.credit),
        l.description ?? "",
        e.isReversal ? "yes" : "",
      ])
    }
  })
  return toCsv(rows)
}

export function journalCsvTemplate(): string {
  return toCsv([
    [...JOURNAL_CSV_HEADERS],
    ["1", "2026-01-05", "INV-001", "Owner capital contribution", "1020", "Bank Account", "10000.00", "", "", ""],
    ["1", "", "", "", "3010", "Owner's Capital", "", "10000.00", "", ""],
    ["2", "2026-01-12", "SALE-001", "Cash sale to customer", "1010", "Cash", "1200.00", "", "", ""],
    ["2", "", "", "", "4010", "Sales Revenue", "", "1200.00", "", ""],
  ])
}

function journalHeaderField(h: string): string | null {
  const k = h.trim().toLowerCase().replace(/[^a-z]/g, "")
  if (["entry", "entryno", "entrynumber", "entryid", "journal", "journalno", "voucher", "voucherno", "txn", "transaction"].includes(k))
    return "entry"
  if (["date", "entrydate", "postingdate", "transactiondate"].includes(k)) return "date"
  if (["reference", "ref", "refno", "referenceno", "document", "docno"].includes(k))
    return "reference"
  if (["description", "narration", "particulars", "entrydescription"].includes(k))
    return "description"
  if (["accountcode", "code", "account", "accountno", "accountnumber"].includes(k))
    return "accountCode"
  if (["accountname", "name"].includes(k)) return "accountName"
  if (["debit", "dr", "debitamount"].includes(k)) return "debit"
  if (["credit", "cr", "creditamount"].includes(k)) return "credit"
  if (["memo", "linedescription", "linememo", "note", "notes"].includes(k)) return "memo"
  if (["reversal", "isreversal"].includes(k)) return "reversal"
  return null
}

/** Accept 1234.5, "1,234.50", " 1 234.50 ". Returns NaN for anything else. */
function parseAmount(s: string): number {
  const t = s.replace(/[\s,]/g, "")
  if (t === "") return 0
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN
  return Math.round(Number(t) * 100) / 100
}

/** Accept YYYY-MM-DD or YYYY/MM/DD (optionally with a time part). */
function parseIsoDate(s: string): string | null {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(s.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return null
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export interface ParsedJournal {
  entries: ImportJournalEntry[]
  /** Problems found while reading the file; those entries are left out. */
  errors: { entry: string; error: string }[]
}

export function csvToJournal(text: string): ParsedJournal {
  const rows = parseCsv(text)
  if (rows.length === 0)
    return { entries: [], errors: [{ entry: "", error: "The file is empty" }] }

  const fields = rows[0].map(journalHeaderField)
  const required: [string, string][] = [
    ["date", "Date"],
    ["description", "Description"],
    ["accountCode", "Account Code"],
    ["debit", "Debit"],
    ["credit", "Credit"],
  ]
  const missing = required
    .filter(([f]) => !fields.includes(f))
    .map(([, header]) => header)
  if (missing.length)
    return {
      entries: [],
      errors: [
        {
          entry: "",
          error: `Missing column(s): ${missing.join(", ")}. Expected headers: ${JOURNAL_CSV_HEADERS.join(", ")}`,
        },
      ],
    }
  const hasEntryCol = fields.includes("entry")

  // Group rows into entries, keeping file order.
  const groups = new Map<string, { label: string; rows: { rowNo: number; rec: Record<string, string> }[] }>()
  rows.slice(1).forEach((cells, i) => {
    const rec: Record<string, string> = {}
    fields.forEach((f, idx) => {
      if (f) rec[f] = unguard((cells[idx] ?? "").trim())
    })
    const key = hasEntryCol && rec.entry
      ? `e:${rec.entry}`
      : `k:${rec.date}|${rec.reference ?? ""}|${rec.description}`
    const label = hasEntryCol && rec.entry ? rec.entry : `row ${i + 2}`
    if (!groups.has(key)) groups.set(key, { label, rows: [] })
    groups.get(key)!.rows.push({ rowNo: i + 2, rec })
  })

  const entries: ImportJournalEntry[] = []
  const errors: ParsedJournal["errors"] = []
  for (const { label, rows: grp } of groups.values()) {
    const first = grp.find((r) => r.rec.date || r.rec.description)?.rec ?? grp[0].rec
    const fail = (error: string) => errors.push({ entry: label, error })

    const date = parseIsoDate(first.date ?? "")
    if (!date) {
      fail(`Invalid or missing date "${first.date ?? ""}" (use YYYY-MM-DD)`)
      continue
    }
    if (!first.description) {
      fail("Description is empty")
      continue
    }

    const lines: ImportJournalEntry["lines"] = []
    let lineError: string | null = null
    for (const { rowNo, rec } of grp) {
      if (!rec.accountCode && !rec.debit && !rec.credit) continue // blank spacer row
      const debit = parseAmount(rec.debit ?? "")
      const credit = parseAmount(rec.credit ?? "")
      if (!rec.accountCode) lineError = "account code is empty"
      else if (Number.isNaN(debit) || Number.isNaN(credit))
        lineError = "amounts must be positive numbers"
      else if (debit > 0 && credit > 0)
        lineError = "a line can't have both a debit and a credit"
      else if (debit === 0 && credit === 0)
        lineError = "the line needs a debit or a credit"
      if (lineError) {
        lineError = `Row ${rowNo}: ${lineError}`
        break
      }
      lines.push({
        accountCode: rec.accountCode,
        debit,
        credit,
        description: rec.memo || null,
      })
    }
    if (lineError) {
      fail(lineError)
      continue
    }
    if (lines.length < 2) {
      fail("An entry needs at least two lines")
      continue
    }
    const dr = round2(lines.reduce((s, l) => s + l.debit, 0))
    const cr = round2(lines.reduce((s, l) => s + l.credit, 0))
    if (dr !== cr) {
      fail(`Not balanced: debits ${dr.toFixed(2)} ≠ credits ${cr.toFixed(2)}`)
      continue
    }
    entries.push({
      label,
      date,
      description: first.description,
      reference: first.reference || null,
      lines,
    })
  }
  return { entries, errors }
}
