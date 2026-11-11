// Excel display formats (v3 B3 "Format" column) and the cell comparison used by
// the "Check against Excel" tab (E1). Formatting reproduces the export text, so the
// business can put the 2 side by side.
import { type XVal, isErr, sig12, mdyyyy } from './excel';
import { parseExcelCell } from './excelParse';

export type Fmt =
  | 'int' // whole number, no separator (Offer ID, Promo Days, fixed points)
  | 'num0' // #,##0
  | 'num2opt' // #,##0 or #,##0.00 when not whole (R&F R)
  | 'num2' // #,##0.00
  | 'cur0' // $#,##0
  | 'cur2' // $#,##0.00
  | 'pct0' // 0%
  | 'pct1' // 0.0%
  | 'pct2' // 0.00%
  | 'dec1' // 0.0
  | 'date' // m/d/yyyy
  | 'text'
  | 'status';

function group(n: number, decimals: number): string {
  return sig12(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format an Excel value as the export shows it. Text ("TBD", "N/A", "null") is returned as is. */
export function formatXVal(v: XVal, fmt: Fmt): string {
  if (isErr(v)) return v.error;
  if (typeof v === 'string') return v;
  if (!Number.isFinite(v)) return '#VALUE!';
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  switch (fmt) {
    case 'int':
      s = String(Math.round(sig12(a)));
      break;
    case 'num0':
      s = group(a, 0);
      break;
    case 'num2opt': {
      const r = Math.round(sig12(a) * 100) / 100;
      s = Number.isInteger(r) ? group(r, 0) : group(r, 2);
      break;
    }
    case 'num2':
      s = group(a, 2);
      break;
    case 'cur0':
      s = `$${group(a, 0)}`;
      break;
    case 'cur2':
      s = `$${group(a, 2)}`;
      break;
    case 'pct0':
      s = `${group(a * 100, 0)}%`;
      break;
    case 'pct1':
      s = `${group(a * 100, 1)}%`;
      break;
    case 'pct2':
      s = `${group(a * 100, 2)}%`;
      break;
    case 'dec1':
      s = group(a, 1);
      break;
    case 'date':
      return mdyyyy(v);
    default:
      return String(v);
  }
  // A value that rounds to zero shows without a minus sign, like Excel.
  return neg && /[1-9]/.test(s) ? `-${s}` : s;
}

/** What the UI shows: Excel's "null" becomes "Not available"; other text as is. */
export function displayXVal(v: XVal, fmt: Fmt): string {
  const s = formatXVal(v, fmt);
  return s === 'null' ? 'Not available' : s;
}

/** Number of decimals in a percentage text such as "15.18%" (2). */
function pctDecimals(t: string): number {
  const m = /\.(\d+)%$/.exec(t);
  return m ? m[1].length : 0;
}

export type MatchResult = { match: boolean; excel: string; proto: string };

/**
 * E1 comparison of one cell. Numbers match within max(1, 0.5% of |Excel|);
 * percentages match on the displayed precision; text matches exactly after
 * trimming; Excel "null" equals the prototype's "null" ("Not available").
 */
export function compareCell(excelRaw: string, proto: XVal, fmt: Fmt): MatchResult {
  const t = String(excelRaw ?? '').trim();
  const protoText = formatXVal(proto, fmt);
  const res = (match: boolean): MatchResult => ({ match, excel: t, proto: protoText });

  if (isErr(proto)) return res(t === proto.error);
  if (typeof proto === 'string') return res(proto.trim() === t);
  // proto is a number
  if (fmt === 'date') return res(mdyyyy(proto) === t);
  if (t === '') return res(false);
  const ex = parseExcelCell(t);
  if (typeof ex !== 'number') return res(false);
  if (t.endsWith('%')) {
    const d = pctDecimals(t);
    return res(`${group(Math.abs(proto) * 100, d)}%` === t.replace(/^-/, '') && (proto < 0) === t.startsWith('-'));
  }
  return res(Math.abs(proto - ex) <= Math.max(1, 0.005 * Math.abs(ex)));
}
