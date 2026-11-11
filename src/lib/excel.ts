// Excel value semantics (v3 B1). Every Results & Forecast and Metadata formula is
// evaluated with these helpers so the prototype gives the same answers as Excel.
//
// A cell is a number, a text (including "" and Excel's own "TBD" / "N/A" / "null"),
// or an error. Arithmetic on text or an error gives an error; IFERROR catches it.

export interface XErr {
  error: string;
}
export type XVal = number | string | XErr;

export const VALUE: XErr = { error: '#VALUE!' };
export const DIV0: XErr = { error: '#DIV/0!' };

export function isErr(v: unknown): v is XErr {
  return typeof v === 'object' && v !== null && 'error' in v;
}
export function isNum(v: XVal): v is number {
  return typeof v === 'number';
}

/**
 * Excel works to 15 significant digits. Round to 12 before ROUND / TEXT /
 * comparisons so 0.145 * 100 = 14.4999... still rounds to 15 like Excel.
 */
export function sig12(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  return Number(x.toPrecision(12));
}

/** Coerce a value for arithmetic: numbers pass, numeric text is converted, else error. */
function coerce(v: XVal): number | XErr {
  if (isErr(v)) return v;
  if (typeof v === 'number') return v;
  const t = v.trim();
  if (t !== '' && /^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return Number(t);
  return VALUE; // "" from a formula, "TBD", "N/A", "null" ... -> #VALUE!
}

function arith(a: XVal, b: XVal, f: (x: number, y: number) => number | XErr): XVal {
  const x = coerce(a);
  if (isErr(x)) return x;
  const y = coerce(b);
  if (isErr(y)) return y;
  const r = f(x, y);
  if (isErr(r)) return r;
  return Number.isFinite(r) ? r : VALUE;
}
export const add = (a: XVal, b: XVal) => arith(a, b, (x, y) => x + y);
export const sub = (a: XVal, b: XVal) => arith(a, b, (x, y) => x - y);
export const mul = (a: XVal, b: XVal) => arith(a, b, (x, y) => x * y);
export const div = (a: XVal, b: XVal) => arith(a, b, (x, y) => (y === 0 ? DIV0 : x / y));

/** IFERROR(x, fallback). */
export function iferror(x: XVal, fallback: XVal): XVal {
  return isErr(x) ? fallback : x;
}

/** AVERAGE over references: text and blanks ignored; errors propagate; none -> #DIV/0!. */
export function average(...vals: XVal[]): XVal {
  let s = 0;
  let n = 0;
  for (const v of vals) {
    if (isErr(v)) return v;
    if (typeof v === 'number') {
      s += v;
      n++;
    }
  }
  return n === 0 ? DIV0 : s / n;
}

/** MIN over numbers (text ignored); errors propagate. */
export function min(...vals: XVal[]): XVal {
  let m: number | null = null;
  for (const v of vals) {
    if (isErr(v)) return v;
    if (typeof v === 'number') m = m === null ? v : Math.min(m, v);
  }
  return m ?? 0;
}

/** Excel ordering: numbers < text; text compares ignoring case. Returns -1/0/1. */
function cmp(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') {
    const x = sig12(a);
    const y = sig12(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === 'number') return -1; // number < text
  if (typeof b === 'number') return 1;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}
type CmpResult = boolean | XErr;
function compare(a: XVal, b: XVal, ok: (c: number) => boolean): CmpResult {
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  return ok(cmp(a, b));
}
/** Excel `=` (text ignores case; text never equals a number). */
export const eq = (a: XVal, b: XVal) => compare(a, b, (c) => c === 0);
export const lt = (a: XVal, b: XVal) => compare(a, b, (c) => c < 0);
export const le = (a: XVal, b: XVal) => compare(a, b, (c) => c <= 0);
export const gt = (a: XVal, b: XVal) => compare(a, b, (c) => c > 0);
export const ge = (a: XVal, b: XVal) => compare(a, b, (c) => c >= 0);

/**
 * IF(cond, a, b). The branches are thunks so only the chosen one is evaluated
 * (matters for IFERROR wrapping). An error condition returns the error.
 */
export function IF(cond: CmpResult | XVal, a: () => XVal, b: () => XVal): XVal {
  if (isErr(cond)) return cond;
  const truthy = typeof cond === 'boolean' ? cond : typeof cond === 'number' ? cond !== 0 : VALUE;
  if (isErr(truthy)) return truthy;
  return truthy ? a() : b();
}
export function AND(...c: CmpResult[]): CmpResult {
  for (const x of c) if (isErr(x)) return x;
  return c.every((x) => x === true);
}
export function OR(...c: CmpResult[]): CmpResult {
  for (const x of c) if (isErr(x)) return x;
  return c.some((x) => x === true);
}

/** Excel ROUND: half away from zero, after removing floating-point noise. */
export function round(x: number, n = 0): number {
  const v = sig12(x);
  const f = 10 ** n;
  const r = Math.round(sig12(Math.abs(v) * f)) / f;
  return v < 0 ? -r : r;
}
/** Excel ROUNDDOWN: toward zero. */
export function rounddown(x: number, n = 0): number {
  const v = sig12(x);
  const f = 10 ** n;
  const r = Math.trunc(sig12(Math.abs(v) * f)) / f;
  return v < 0 ? -r : r;
}
/** ROUND on an Excel value (error for text). */
export function xround(v: XVal, n = 0): XVal {
  const x = coerce(v);
  return isErr(x) ? x : round(x, n);
}
export function xrounddown(v: XVal, n = 0): XVal {
  const x = coerce(v);
  return isErr(x) ? x : rounddown(x, n);
}

/** Number joined with & : shortest form, no separators, no trailing zeros. */
export function num2text(x: number): string {
  const v = sig12(x);
  if (Object.is(v, -0) || v === 0) return '0';
  const s = String(v);
  if (!/e/i.test(s)) return s;
  return v.toFixed(Math.max(0, 15 - Math.floor(Math.log10(Math.abs(v))) - 1)).replace(/\.?0+$/, '');
}
/** Concatenate Excel values with &. Errors propagate. */
export function cat(...parts: XVal[]): XVal {
  let s = '';
  for (const p of parts) {
    if (isErr(p)) return p;
    s += typeof p === 'number' ? num2text(p) : p;
  }
  return s;
}

/** TEXT(x, "0%") / TEXT(x, "0.0%"). */
export function textPct(x: number, fmt: '0%' | '0.0%'): string {
  const d = fmt === '0%' ? 0 : 1;
  const r = round(x * 100, d);
  return `${d === 0 ? r.toFixed(0) : r.toFixed(1)}%`;
}
export function xtextPct(v: XVal, fmt: '0%' | '0.0%'): XVal {
  const x = coerce(v);
  return isErr(x) ? x : textPct(x, fmt);
}
/** TEXT(x, "0.0"). */
export function xtext1(v: XVal): XVal {
  const x = coerce(v);
  return isErr(x) ? x : round(x, 1).toFixed(1);
}

/** LEFT(text, n) and LEN(text) on an Excel value (numbers become their text). */
export function left(v: XVal, n: XVal): XVal {
  if (isErr(v)) return v;
  const k = coerce(n);
  if (isErr(k)) return k;
  if (k < 0) return VALUE;
  const s = typeof v === 'number' ? num2text(v) : v;
  return s.slice(0, Math.floor(k));
}
export function len(v: XVal): XVal {
  if (isErr(v)) return v;
  return (typeof v === 'number' ? num2text(v) : v).length;
}

// ---------------------------------------------------------------- dates
const EPOCH = Date.UTC(1899, 11, 30);
/** ISO yyyy-MM-dd -> Excel serial day number, or null. */
export function serial(iso: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EPOCH) / 86_400_000);
}
/** Excel serial -> {y, m, d}. */
export function fromSerial(n: number): { y: number; m: number; d: number } {
  const dt = new Date(EPOCH + Math.round(n) * 86_400_000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
/** Local Date (as-of) -> Excel serial. */
export function serialOfDate(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86_400_000);
}
/** TEXT(serial, "m/d"). */
export function textMD(v: XVal): XVal {
  const x = coerce(v);
  if (isErr(x)) return x;
  const { m, d } = fromSerial(x);
  return `${m}/${d}`;
}
/** Serial -> m/d/yyyy (Excel default date display). */
export function mdyyyy(n: number): string {
  const { y, m, d } = fromSerial(n);
  return `${m}/${d}/${y}`;
}
export function serialToIso(n: number): string {
  const { y, m, d } = fromSerial(n);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
