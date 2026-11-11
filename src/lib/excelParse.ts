// Parsing helpers for the Excel CSV exports (v3 Package A). Shared by the import
// script (scripts/importExcel.ts) and the tests. Pure functions, no app state.

/** An Excel error value such as #N/A or #VALUE!. */
export interface ExcelError {
  error: string;
}
/** A parsed Excel cell: number, kept text, blank, or an error. */
export type ParsedCell = number | string | '' | ExcelError;

export function isExcelError(v: unknown): v is ExcelError {
  return typeof v === 'object' && v !== null && 'error' in v;
}

const ERROR_TEXTS = new Set(['#N/A', '#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#NUM!', '#NULL!']);
/** Text values Excel produces on purpose; they stay text. */
const KEPT_TEXT = new Set(['TBD', 'N/A', 'null']);

/**
 * Parse one display-formatted cell (A1 rules):
 * "$1,234.56" -> 1234.56, "(1,234)" -> -1234, "15.2%" -> 0.152, "-" -> 0,
 * "TBD" / "N/A" / "null" stay text, "#N/A" -> { error }. Other text is returned trimmed.
 */
export function parseExcelCell(raw: unknown): ParsedCell {
  if (raw === null || raw === undefined) return '';
  const t = String(raw).trim();
  if (t === '') return '';
  if (ERROR_TEXTS.has(t)) return { error: t };
  if (KEPT_TEXT.has(t)) return t;
  if (t === '-') return 0; // Excel accounting zero (" -   " trims to "-")

  let s = t;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    neg = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1).trim();
  }
  let pct = false;
  if (s.endsWith('%')) {
    pct = true;
    s = s.slice(0, -1).trim();
  }
  if (s.startsWith('$')) s = s.slice(1).trim();
  const cleaned = s.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(cleaned) && !/^\d+\.$/.test(cleaned)) return t; // not a number: keep text
  let n = Number(cleaned);
  if (!Number.isFinite(n)) return t;
  if (pct) n = n / 100;
  if (neg) n = -n;
  // Remove binary noise introduced by the % division (e.g. 15.2 / 100).
  return pct ? Number(n.toPrecision(15)) : n;
}

/** Parse m/d/yyyy to ISO yyyy-MM-dd, or null when the text is not a date. */
export function parseExcelDate(raw: unknown): string | null {
  const t = String(raw ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 0-based column index from an Excel letter (A -> 0, AA -> 26). */
export function colIndex(letter: string): number {
  let n = 0;
  for (const c of letter.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel column letter from a 0-based index. */
export function colLetter(index: number): string {
  let s = '';
  let i = index + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** Inclusive list of column letters, e.g. range('BW', 'FC'). */
export function colRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = colIndex(from); i <= colIndex(to); i++) out.push(colLetter(i));
  return out;
}

/** Trim a header and collapse internal whitespace / line breaks. */
export function normHeader(h: unknown): string {
  return String(h ?? '').replace(/\s+/g, ' ').trim();
}
