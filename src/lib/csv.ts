import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
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
