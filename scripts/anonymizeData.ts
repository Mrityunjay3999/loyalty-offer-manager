/* eslint-disable no-console */
// Turns the real Excel import into realistic DUMMY data for the prototype.
//
// Run with `npm run anonymize` (also runs at the end of `npm run import:excel`).
// Reads the real files from data/private/ (git-ignored, never shipped):
//   data/private/imported/{offers.base,excelSnapshot.rf,excelSnapshot.metadata,importReport}.json
//   data/private/sampleOffers.original.json
//   data/private/reference.original.json
// Writes the dummy versions the app ships:
//   src/data/imported/*.json, src/data/sampleOffers.json, src/data/reference.json
//
// What changes: Offer IDs, offer names, descriptions, descriptors / codes, SKUs,
// brands, every metric and forecast input, thresholds and fixed points, division
// shares, and dates (each offer moves by a few days inside its own months).
// What stays: fields, dropdown values and option lists, statuses, categories,
// tiering, countries, offer designs, multipliers, the Excel formulas (engine) and
// the structure of every Excel data issue, so the Check tab tells the same story.
//
// The Excel snapshots are rebuilt cell by cell: a cell that matched the prototype
// is re-written from the dummy offer in the same Excel display format; a cell that
// did not match keeps the same kind of gap (same ratio, "null", error, blank).
// Deterministic: the same inputs always give the same dummy data.

import fs from 'node:fs';
import path from 'node:path';
import { computeRfCells, totalOfferDaysOf } from '../src/lib/rfEngine';
import { computeMdCells } from '../src/lib/mdEngine';
import { compareCell, formatXVal, type Fmt } from '../src/lib/excelFormat';
import { RF_BY_LETTER } from '../src/lib/forecastColumnRegistry';
import { MD_REGISTRY } from '../src/lib/mdRegistry';
import { parseExcelCell } from '../src/lib/excelParse';
import { sig12, mdyyyy, isErr, type XVal } from '../src/lib/excel';
import { fiscalLookup } from '../src/lib/calculations';
import { runCheck, metadataReason, type Snapshot, type ImportIssue } from '../src/lib/excelCheck';
import type { ImportMeta, OfferRecord } from '../src/lib/types';

const ROOT = process.cwd();
const PRIV = path.join(ROOT, 'data/private');
const OUT = path.join(ROOT, 'src/data/imported');
const AS_OF = new Date(2026, 10, 11);
const SEED = 'lom-dummy-v1';
const EXPORT_ISO = '2026-11-11';
const DATE_FIELDS = ['startDate', 'endDate', 'earlyActivationDate', 'ltbpExpiryDisplayed', 'ltbpRemovalDate', 'pointsAwardDate', 'forecastDate'];
const FIRST_ID = 3001;

type Rec = OfferRecord & { _import?: ImportMeta };
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

const realBase = readJson<Rec[]>(path.join(PRIV, 'imported/offers.base.json'));
const realRf = readJson<Snapshot>(path.join(PRIV, 'imported/excelSnapshot.rf.json'));
const realMd = readJson<Snapshot>(path.join(PRIV, 'imported/excelSnapshot.metadata.json'));
const realReport = readJson<Record<string, unknown> & { issues: ImportIssue[] }>(path.join(PRIV, 'imported/importReport.json'));
const realSamples = readJson<Rec[]>(path.join(PRIV, 'sampleOffers.original.json'));
const realReference = readJson<Record<string, unknown>>(path.join(PRIV, 'reference.original.json'));

// ---------------------------------------------------------------- randomness
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
type Rng = () => number;
function rng(key: string): Rng {
  let a = hash(`${SEED}|${key}`);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
const pick = <T>(r: Rng, a: T[]): T => a[Math.floor(r() * a.length)];
function shuffle<T>(r: Rng, a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ---------------------------------------------------------------- helpers
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isNA = (v: unknown) =>
  v === null || v === undefined || v === '' || /^(n\/a|na|0|tbd|null|none|-)$/i.test(String(v).trim());
function addDays(iso: string, d: number): string {
  const [y, m, dd] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
}
const ymd = (iso: string) => iso.replace(/-/g, '');
function numOf(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
}
const sameType = (orig: unknown, n: number): unknown => (typeof orig === 'string' ? String(n) : n);
const thrOf = (v: unknown): number | null => numOf(v) ?? (/\((\d+)\)\s*$/.exec(String(v ?? '')) ? Number(/\((\d+)\)\s*$/.exec(String(v))![1]) : null);

const NICE_PTS = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000,
  6000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000, 250000, 500000, 1000000];
const NICE_THR = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 120, 125, 150, 175, 200, 250, 300];
function niceNeighbour(r: Rng, v: number, list: number[]): number {
  let idx = 0;
  for (let i = 0; i < list.length; i++) if (Math.abs(list[i] - v) < Math.abs(list[idx] - v)) idx = i;
  const opts = [-2, -1, 1, 2].map((o) => idx + o).filter((i) => i >= 0 && i < list.length);
  return list[pick(r, opts)];
}
function niceRound(x: number): number {
  const a = Math.abs(x);
  const step = a < 1000 ? 10 : a < 10000 ? 50 : a < 100000 ? 500 : 1000;
  return Math.max(step, Math.round(x / step) * step);
}

// ---------------------------------------------------------------- word lists
const SPECIES = ['DOG', 'CAT', 'PUPPY', 'KITTEN', 'BIRD', 'FISH', 'REPTILE', 'SMALLPET', 'HAMSTER', 'BUNNY', 'AQUA', 'PET'];
const GOODS = ['TREATS', 'CHEWS', 'KIBBLE', 'LITTER', 'TOYS', 'BEDS', 'BOWLS', 'LEASHES', 'COLLARS', 'DENTAL', 'GROOMING',
  'HABITAT', 'TANKS', 'FEEDERS', 'VITAMINS', 'WETFOOD', 'JERKY', 'BISCUITS', 'SCRATCHERS', 'CRATES', 'BEDDING', 'SNACKS',
  'FOOD', 'CARE', 'GEAR', 'ESSENTIALS', 'NUTRITION', 'APPAREL', 'FILTERS', 'SEED'];
const EVENTS = ['SPRING', 'SUMMER', 'FALL', 'WINTER', 'HOLIDAY', 'WEEKEND', 'FLASH', 'MEGA', 'BONUS', 'WELCOME', 'BTS',
  'NEWYEAR', 'PAWDAY', 'FETCH', 'SNUGGLE', 'HAPPYTAIL', 'WAGGY', 'PURRFECT', 'COZY', 'FRESH', 'SUNNY', 'MAPLE', 'FROSTY',
  'BLOOM', 'HARVEST', 'SPARKLE', 'TRAIL', 'SPLASH', 'CRUNCH', 'ZOOMIES'];
const LOYALTY = ['MEMBERBONUS', 'TIERBOOST', 'BIRTHDAYTREAT', 'ANNIVBONUS', 'WELCOMEBACK', 'REFERAFRIEND', 'APPBONUS',
  'DOUBLEDAYS', 'POINTSPARTY', 'VIPPERK', 'GOLDPAW', 'STREAK', 'CHECKIN', 'SURVEYBONUS', 'REVIEWBONUS', 'TIERUP',
  'MEMBERWEEK', 'PAWPOINTS', 'LOYALPAL', 'BONUSBARK', 'TAILWAG', 'PETPASS', 'PERKPACK', 'REWARDRUSH', 'GOLDCOLLAR'];
const CHARITY = ['RESCUEDONATE', 'SHELTERGIVE', 'ADOPTHELP', 'KINDPAWS', 'GIVEPAWS', 'FOSTERFUND', 'HOMEWARD', 'HELPINGHOUNDS'];
const SERVICES = ['GROOMSPA', 'TRAINCLASS', 'VETCHECK', 'DAYCAMP', 'PETHOTEL', 'BATHTIME', 'NAILTRIM', 'PUPPYCLASS', 'SPADAY'];
const EVENTS_INSTORE = ['PUPPYPARTY', 'ADOPTIONDAY', 'PETEXPO', 'COSTUMEPARADE', 'MEETGREET', 'PAWPARADE', 'PHOTODAY',
  'STOREOPENING', 'PETFAIR', 'TAILGATE', 'WORKSHOP'];
const DIGITAL = ['APPEXCLUSIVE', 'ONLINEONLY', 'INAPPDEAL', 'APPCHECKIN', 'WEBBONUS', 'AUTOSHIPBONUS', 'APPLAUNCH', 'EMAILBONUS'];
const GENERIC_SEG = new Set(['CAN', 'US', 'USPR', 'PR', 'IMPO', 'VIPP', 'TGT', 'SELECT', 'AO', 'RSVP', 'MIXED', 'OPTIN',
  'INFO', 'LTBP', 'JBP', 'ALL', 'SMS', 'APP', 'ENTRY', 'BENEFIT', 'BDAY', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL',
  'AUG', 'SEP', 'SEPT', 'OCT', 'NOV', 'DEC', 'EOD', 'TEST', 'ONLINE', 'INSTORE', 'BOTH', 'NEW', 'BROAD']);

const MONTHS_RE = /^((JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT?|OCT|NOV|DEC)(TO)?)+$/;
for (const w of ['SALON', 'COMING', 'BOOST', 'PTSBOOST', 'ONLINEONLY', 'WEEKLY', 'DAILY', 'MONTHLY', 'BONUS', 'POINTS', 'TIER',
  'MEMBER', 'MEMBERS', 'EVENT', 'GIFT', 'CHOICE']) GENERIC_SEG.add(w);
type Theme = 'merch' | 'loyalty' | 'charity' | 'services' | 'event' | 'digital';
function themeOf(o: Rec | undefined): Theme {
  const c = String(o?.category ?? '').toUpperCase();
  const s = String(o?.subCategory ?? '').toUpperCase();
  if (/CHARIT/.test(c)) return 'charity';
  if (/SERVICE/.test(c) || /SALON|GROOM|TRAIN|VET/.test(s)) return 'services';
  if (/EVENT/.test(c)) return 'event';
  if (/DIGITAL|BARCODE/.test(c)) return 'digital';
  if (/LOYALTY|BENEFIT|CRM|ASSOCIATE|REDEMPTION|IMPO|PARTNER|SWEEPS/.test(c)) return 'loyalty';
  return 'merch';
}
const SPECIES_FLAGS: Array<[string, string]> = [
  ['dogCustomer', 'dog'], ['catCustomer', 'cat'], ['birdCustomer', 'bird'],
  ['smallPetCustomer', 'small pet'], ['reptileCustomer', 'reptile'], ['aquaticCustomer', 'fish'],
];
function speciesWord(o: Rec): string {
  const on = SPECIES_FLAGS.filter(([k]) => /^y/i.test(String(o[k] ?? ''))).map(([, w]) => w);
  return on.length === 1 ? on[0] : 'pet';
}
function goodsWord(o: Rec, r: Rng): string {
  const sp = speciesWord(o);
  const bySpecies: Record<string, string[]> = {
    bird: ['bird seed', 'cages', 'perches', 'bird treats'],
    fish: ['fish food', 'filters', 'aquarium decor', 'water care'],
    reptile: ['habitats', 'heat lamps', 'reptile food', 'substrate'],
    'small pet': ['bedding', 'hay', 'small pet food', 'habitats'],
  };
  if (bySpecies[sp]) return pick(r, bySpecies[sp]);
  if (/^y/i.test(String(o.consumablesOffer ?? ''))) return pick(r, ['food', 'treats', 'chews', 'snacks', 'wet food', sp === 'cat' ? 'litter' : 'dental chews']);
  if (/^y/i.test(String(o.hardgoodsOffer ?? ''))) return pick(r, ['toys', 'beds', 'bowls', 'leashes', 'crates', sp === 'cat' ? 'scratchers' : 'collars']);
  if (/^y/i.test(String(o.specialtyOffer ?? ''))) return pick(r, ['supplements', 'grooming tools', 'vitamins']);
  return pick(r, ['essentials', 'favourites', 'supplies']);
}

// ---------------------------------------------------------------- name tokens
const realTokens = new Set<string>();
const collectTokens = (name: string) => {
  for (const seg of name.split(/[_\s\-$]+/)) if (/[A-Z]{3,}/.test(seg)) realTokens.add(seg.toUpperCase());
};
for (const o of [...realBase, ...realSamples]) collectTokens(String(o.offerName ?? ''));

const tokenMap = new Map<string, string>();
const usedTokens = new Set<string>();
const SUFFIXES = ['PLUS', 'MAX', 'XTRA', 'DUO', 'TRIO', 'SAVER', 'PERKS', 'DAYS', 'WEEK', 'FEST', 'DEALS', 'BLITZ', 'BASH', 'RUSH'];
function freshToken(base: string, r: Rng): string {
  const sfx = shuffle(r, SUFFIXES);
  const cands = [base, ...sfx.map((x) => base + x), ...sfx.flatMap((x) => sfx.map((y) => (x === y ? '' : base + x + y))).filter(Boolean)];
  for (const t of cands) {
    if (!usedTokens.has(t) && !realTokens.has(t)) {
      usedTokens.add(t);
      return t;
    }
  }
  let n = 2;
  while (usedTokens.has(`${base}${n}`)) n++;
  usedTokens.add(`${base}${n}`);
  return `${base}${n}`;
}
const SPECIES_TOKEN: Record<string, string[]> = {
  dog: ['DOG', 'PUPPY'], cat: ['CAT', 'KITTEN'], bird: ['BIRD'], fish: ['FISH', 'AQUA'], reptile: ['REPTILE'], 'small pet': ['SMALLPET', 'HAMSTER', 'BUNNY'],
};
function makeToken(old: string, theme: Theme, o?: Rec): string {
  const r = rng(`tok|${old}`);
  const season = r() < 0.3 ? pick(r, EVENTS) : '';
  let base: string;
  switch (theme) {
    case 'loyalty':
      base = season + pick(r, LOYALTY);
      break;
    case 'charity':
      base = season + pick(r, CHARITY);
      break;
    case 'services':
      base = season + pick(r, SERVICES);
      break;
    case 'event':
      base = season + pick(r, EVENTS_INSTORE);
      break;
    case 'digital':
      base = season + pick(r, DIGITAL);
      break;
    default: {
      const form = Math.floor(r() * 4);
      const e = pick(r, EVENTS);
      const spw = o ? speciesWord(o) : 'pet';
      const sp = SPECIES_TOKEN[spw] ? pick(r, SPECIES_TOKEN[spw]) : pick(r, SPECIES);
      const g = o ? goodsWord(o, r).toUpperCase().replace(/[^A-Z]/g, '') : pick(r, GOODS);
      const spg = g.includes(sp) ? g : sp + g;
      base = form === 0 ? e + g : form === 3 ? spg + 'DEAL' : spg;
    }
  }
  return freshToken(base, r);
}
function mapToken(seg: string, theme: Theme, o?: Rec): string {
  const up = seg.toUpperCase();
  if (GENERIC_SEG.has(up) || up.length <= 3 || MONTHS_RE.test(up)) return seg;
  if (/^\d+X$/i.test(seg) || /^\d+K$/i.test(seg) || /^\d+$/.test(seg)) return seg;
  if (!/[A-Za-z]{2,}/.test(seg)) return seg;
  const key = up;
  if (tokenMap.has(key)) return tokenMap.get(key)!;
  let out: string;
  const m = /^(CAN|JBP|CANJBP)(.{3,})$/.exec(up);
  if (m) out = m[1] + makeToken(m[2], theme, o);
  else out = makeToken(up, theme, o);
  tokenMap.set(key, out);
  return out;
}

// ---------------------------------------------------------------- numbers in names
const numMap = new Map<string, string>();
function mapNumber(seg: string): string {
  if (numMap.has(seg)) return numMap.get(seg)!;
  const r = rng(`num|${seg}`);
  const n = Number(seg);
  let out = String(niceNeighbour(r, n, n >= 25 ? NICE_PTS : NICE_THR));
  if (seg.length >= 4 && !NICE_PTS.includes(n)) {
    // store numbers and other IDs: random number of the same length
    out = String(Math.floor(between(r, 10 ** (seg.length - 1), 10 ** seg.length - 1)));
  }
  numMap.set(seg, out);
  return out;
}

// ---------------------------------------------------------------- per-offer plan
interface Plan {
  delta: number;
  r: Rng;
  kAct: number;
  kAud: number;
  kBm: number;
  kF: number;
  newStart: string;
}
const plans = new Map<Rec, Plan>();
function planFor(o: Rec, key: string): Plan {
  if (plans.has(o)) return plans.get(o)!;
  const r = rng(`offer|${key}`);
  const start = String(o.startDate ?? '');
  const end = String(o.endDate ?? '');
  let delta = 0;
  if (ISO.test(start)) {
    for (const d of shuffle(r, [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const s2 = addDays(start, d);
      const e2 = ISO.test(end) ? addDays(end, d) : '';
      // stay inside the same months and on the same side of the export date for every date field
      const sameSide = DATE_FIELDS.every((f) => {
        const v = String(o[f] ?? '').slice(0, 10);
        if (!ISO.test(v)) return true;
        const w = addDays(v, d);
        return (v <= EXPORT_ISO) === (w <= EXPORT_ISO) && (v < EXPORT_ISO) === (w < EXPORT_ISO) && v.slice(0, 7) === w.slice(0, 7);
      });
      if (sameSide && s2.slice(0, 7) === start.slice(0, 7) && (!e2 || e2.slice(0, 7) === end.slice(0, 7))) {
        delta = d;
        break;
      }
    }
  }
  const kAct = between(r, 0.6, 1.45);
  const p: Plan = {
    delta,
    r,
    kAct,
    kAud: between(r, 0.65, 1.4),
    kBm: kAct * between(r, 0.85, 1.15),
    kF: between(r, 0.6, 1.4),
    newStart: ISO.test(start) ? addDays(start, delta) : start,
  };
  plans.set(o, p);
  return p;
}

// ---------------------------------------------------------------- Offer IDs
const realById = new Map<number, Rec>();
for (const o of realBase) realById.set(o.offerId as number, o);
const extraSamples = realSamples.filter((s) => typeof s.offerId === 'number' && !realById.has(s.offerId as number));
const idSet: Array<{ id: number; start: string }> = [];
for (const o of realBase) idSet.push({ id: o.offerId as number, start: planFor(o, `id${o.offerId}`).newStart });
for (const s of extraSamples) idSet.push({ id: s.offerId as number, start: planFor(s, `id${s.offerId}`).newStart });
idSet.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));
const idMap = new Map<number, number>();
idSet.forEach((x, i) => idMap.set(x.id, FIRST_ID + i));
const mapId = (id: number) => idMap.get(id) ?? id;

// ---------------------------------------------------------------- offer names
const nameMap = new Map<string, string>();
const usedNames = new Set<string>();
function buildName(old: string, real: Rec | undefined, dummyVals: { fixedPoints?: unknown; threshold?: unknown } | undefined): string {
  if (nameMap.has(old)) return nameMap.get(old)!;
  const theme = themeOf(real);
  const segs = old.split('_');
  const p = real ? plans.get(real) : undefined;
  const out = segs.map((seg, i) => {
    if (i === 0 && /^\d{8}$/.test(seg)) {
      if (real && ISO.test(String(real.startDate)) && seg === ymd(String(real.startDate))) return ymd(p!.newStart);
      const iso = `${seg.slice(0, 4)}-${seg.slice(4, 6)}-${seg.slice(6, 8)}`;
      return ISO.test(iso) && !Number.isNaN(Date.parse(iso)) ? ymd(addDays(iso, p?.delta ?? 0)) : seg;
    }
    if (i === 0 && /^(19|20)\d{2}$/.test(seg)) return seg;
    if (/^\d+$/.test(seg)) {
      if (real && dummyVals) {
        if (numOf(real.fixedPoints) === Number(seg) && numOf(dummyVals.fixedPoints) !== null) return String(numOf(dummyVals.fixedPoints));
        const rt = thrOf(real.offerThreshold);
        const dt = thrOf(dummyVals.threshold);
        if (rt !== null && dt !== null && (rt === Number(seg) || rt - 1 === Number(seg))) return String(dt);
      }
      return mapNumber(seg);
    }
    // "PENNSPEND$2", "1K", "DOGFOOD" ...
    return seg.replace(/[A-Za-z][A-Za-z0-9]*/g, (w) => (/^\d+[XK]$/i.test(w) ? w : mapToken(w, theme, real)));
  });
  let name = out.join('_');
  let n = 2;
  while (usedNames.has(name) || realNameSet.has(name)) name = `${out.join('_')}_V${n++}`;
  usedNames.add(name);
  nameMap.set(old, name);
  namePairsCache = null;
  return name;
}
const realNameSet = new Set<string>([...realBase, ...realSamples].map((o) => String(o.offerName ?? '')));

// ---------------------------------------------------------------- codes, SKUs, brands
const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIG = '0123456789';
const cr = rng('cipher');
const LETP = shuffle(cr, LET.split('')).join('');
const DIGP = shuffle(cr, DIG.split('')).join('');
const cipher = (tok: string) =>
  tok.replace(/[A-Z0-9]/g, (c) => (c >= 'A' && c <= 'Z' ? LETP[LET.indexOf(c)] : DIGP[DIG.indexOf(c)]));
function replaceNames(s: string): string {
  if (!s) return s;
  if (nameMap.has(s)) return nameMap.get(s)!;
  let out = s;
  for (const [o, n] of sortedNamePairs()) if (out.includes(o)) out = out.split(o).join(n);
  return out;
}
let namePairsCache: Array<[string, string]> | null = null;
function sortedNamePairs(): Array<[string, string]> {
  if (!namePairsCache) namePairsCache = [...nameMap.entries()].filter(([o]) => o.length >= 8).sort((a, b) => b[0].length - a[0].length);
  return namePairsCache;
}
function anonCode(v: unknown): unknown {
  if (typeof v !== 'string' || isNA(v)) return v;
  if (/[a-z]/.test(v) && !/[A-Z0-9]{6,}/.test(v)) return v; // prose ("Using same code as USPR", "Tier_Override_VIPP")
  const named = replaceNames(v);
  if (named !== v) return named;
  return v.replace(/[A-Za-z0-9]+/g, (tok) => {
    if (/^20\d{6}$/.test(tok)) return tok; // date stamps
    if (/\d/.test(tok)) return cipher(tok.toUpperCase());
    if (tok.length >= 4 && tok === tok.toUpperCase() && !GENERIC_SEG.has(tok)) return mapToken(tok, 'merch');
    return tok;
  });
}
const skuMap = new Map<string, string>();
function anonSkus(v: unknown): unknown {
  if (typeof v !== 'string' || isNA(v)) return v;
  return v.replace(/\d{5,9}/g, (d) => {
    if (!skuMap.has(d)) {
      const r = rng(`sku|${d}`);
      skuMap.set(d, String(Math.floor(between(r, 10 ** (d.length - 1), 10 ** d.length - 1))));
    }
    return skuMap.get(d)!;
  });
}
const brandPool = [...new Set(realBase.map((o) => String(o.primaryBrand ?? '')).filter((b) => b && !isNA(b)))].sort();

// ---------------------------------------------------------------- descriptions
const fmtInt = (n: number) => n.toLocaleString('en-US');
function promoDescription(d: Rec, orig: unknown, r: Rng): unknown {
  if (typeof orig !== 'string' || isNA(orig)) return orig;
  const sp = speciesWord(d);
  const gd = goodsWord(d, r);
  const pts = numOf(d.fixedPoints);
  const thr = thrOf(d.offerThreshold);
  const online = d.channel === 'Online' ? ' online' : '';
  switch (d.offerDesign) {
    case 'Multiplier':
      return `${d.multiplier} points on select ${sp} ${gd}${online}`;
    case 'Fixed Point':
    case 'Multiple threshold':
    case 'Multi-trip challenge':
      if (pts && thr) return `Earn ${fmtInt(pts)} bonus points when you spend $${thr}+ on ${sp} ${gd}${online}`;
      if (pts) return `Earn ${fmtInt(pts)} bonus points on your next ${sp} ${gd} purchase${online}`;
      return `Earn bonus points on ${sp} ${gd}${online}`;
    case 'IMP only':
      return `In-app message: ${pick(r, ['new season', 'member news', 'store event', 'product launch'])} for ${sp} parents`;
    case 'Points donations':
      return `Donate your points to partner animal shelters${pts ? ` (${fmtInt(pts)} points per donation)` : ''}`;
    case 'Extra entries':
      return `Earn extra sweepstakes entries when you shop ${sp} ${gd}${online}`;
    case 'Activation Only - RSVP':
      return `RSVP in the app to join the in-store ${pick(r, ['pet party', 'adoption day', 'photo day', 'training workshop'])}`;
    case 'Activation Only - Internal Reward':
    case 'Internal Reward':
      return `Activate to unlock a member reward on ${sp} ${gd}`;
    case 'Activation Only - Points upload':
      return `Activate the offer; ${pts ? `${fmtInt(pts)} points` : 'bonus points'} are uploaded after the event`;
    case 'Activation Only - Tier Upgrade':
      return 'Activate to move up a member tier for the rest of the year';
    case 'Benefit - Choose 2X':
      return `Choice benefit: 2X points on ${sp} ${gd} all month`;
    case 'Salon cert':
      return `Grooming salon certificate worth ${pts ? `${fmtInt(pts)} points` : 'bonus points'}`;
    case 'Interactions':
      return `Earn ${pts ? `${fmtInt(pts)} bonus points` : 'bonus points'} for completing an in-app activity`;
    case 'Limited Time Bonus Offer':
      return `Limited time: ${pts ? `${fmtInt(pts)} bonus points` : 'bonus points'} for members who shop ${sp} ${gd}`;
    default:
      return `${d.offerDesign}: member offer on ${sp} ${gd}${online}`;
  }
}
function shortDescription(d: Rec, orig: unknown, r: Rng): unknown {
  if (typeof orig !== 'string' || isNA(orig)) return orig;
  const title = pick(r, ['Member Bonus', 'Choice Benefit', 'Weekend Deal', 'Store Event', 'Points Boost', 'App Exclusive']);
  const pts = numOf(d.fixedPoints);
  const reward = d.multiplier && !isNA(d.multiplier) ? `${d.multiplier} Points` : pts ? `${fmtInt(pts)} Points` : 'Bonus Points';
  return `${title}: Earn ${reward}`;
}

// ---------------------------------------------------------------- dummy offer
function scaleInt(v: unknown, k: number): unknown {
  const n = numOf(v);
  if (n === null || n === 0) return v;
  return sameType(v, Math.max(1, Math.round(n * k)));
}
function anonOffer(real: Rec, key: string): Rec {
  const p = planFor(real, key);
  const r = p.r;
  const d: Rec = { ...real };
  // dates
  for (const f of DATE_FIELDS) {
    const v = d[f];
    if (typeof v === 'string' && ISO.test(v.slice(0, 10))) d[f] = addDays(v.slice(0, 10), p.delta) + v.slice(10);
  }
  // offer parameters
  const pts = numOf(real.fixedPoints);
  if (pts && pts > 0) d.fixedPoints = sameType(real.fixedPoints, niceNeighbour(r, pts, NICE_PTS));
  const pair = /^\s*(\d+)\s*\((\d+)\)\s*$/.exec(String(real.offerThreshold ?? ''));
  const thr = numOf(real.offerThreshold) ?? (pair ? Number(pair[2]) : null);
  if (thr && thr > 0) {
    const t2 = niceNeighbour(r, thr, NICE_THR);
    d.offerThreshold = pair ? `${t2 - (Number(pair[2]) - Number(pair[1]))} (${t2})` : sameType(real.offerThreshold, t2);
    for (const f of ['inspireOfferThreshold', 'displayOfferThreshold']) {
      const n = numOf(real[f]);
      if (n !== null && n > 0) d[f] = sameType(real[f], Math.max(1, t2 + (n - thr)));
    }
  }
  const maxQ = numOf(real.awardRuleMaxQty);
  if (maxQ && maxQ >= 2) d.awardRuleMaxQty = sameType(real.awardRuleMaxQty, Math.max(2, maxQ + pick(r, [-1, 1])));
  // metrics
  const act = numOf(real.activations);
  const aud = numOf(real.audienceSize);
  const bm = numOf(real.bonusedMembers);
  d.activations = scaleInt(real.activations, p.kAct);
  d.audienceSize = scaleInt(real.audienceSize, p.kAud);
  d.bonusedMembers = scaleInt(real.bonusedMembers, p.kBm);
  const act2 = numOf(d.activations);
  const aud2 = numOf(d.audienceSize);
  if (act !== null && aud !== null && act2 !== null && aud2 !== null && aud >= act && aud2 < act2) d.audienceSize = sameType(real.audienceSize, Math.round(act2 * between(r, 1.05, 1.5)));
  const bm2 = numOf(d.bonusedMembers);
  if (act !== null && bm !== null && act2 !== null && bm2 !== null && bm <= act && bm2 > act2) d.bonusedMembers = sameType(real.bonusedMembers, act2);
  d.bonusedMembersUnique = scaleInt(real.bonusedMembersUnique, p.kBm);
  d.earlyActivationCount = scaleInt(real.earlyActivationCount, p.kAct);
  const R = numOf(real.bonusPtsIssued);
  if (R !== null && R !== 0) {
    const bmRatio = bm && numOf(d.bonusedMembers) ? numOf(d.bonusedMembers)! / bm : p.kBm;
    const ptsRatio = pts && numOf(d.fixedPoints) ? numOf(d.fixedPoints)! / pts : between(r, 0.92, 1.08);
    let R2 = R * bmRatio * ptsRatio;
    if (Number.isInteger(R)) R2 = Math.round(R2);
    else {
      R2 = Math.round(R2 * 100) / 100;
      if (Number.isInteger(R2)) R2 += 0.25;
    }
    d.bonusPtsIssued = sameType(real.bonusPtsIssued, R2);
  }
  // forecast inputs
  const days = totalOfferDaysOf(real);
  const lo = numOf(real.activationByDayLow);
  const hi = numOf(real.activationByDayHigh);
  if (lo !== null && lo > 0) {
    const tLo = days ? niceRound(lo * days * p.kF) : lo * p.kF;
    d.activationByDayLow = days ? tLo / days : tLo;
    if (hi !== null && hi > 0) {
      let tHi = days ? niceRound(hi * days * p.kF * between(r, 0.95, 1.05)) : hi * p.kF;
      if (tHi < tLo) tHi = tLo;
      d.activationByDayHigh = days ? tHi / days : tHi;
    }
  } else if (hi !== null && hi > 0) {
    d.activationByDayHigh = days ? niceRound(hi * days * p.kF) / days : hi * p.kF;
  }
  const rate = (v: unknown, k: number) => {
    const n = numOf(v);
    if (n === null || n === 0) return v;
    const step = n < 0.05 ? 0.001 : 0.005;
    return Math.min(1, Math.max(step, Math.round((n * k) / step) * step));
  };
  const kr = between(r, 0.8, 1.2);
  d.bonusRateLow = rate(real.bonusRateLow, kr);
  d.bonusRateHigh = rate(real.bonusRateHigh, kr * between(r, 0.97, 1.03));
  if (numOf(d.bonusRateLow) !== null && numOf(d.bonusRateHigh) !== null && (d.bonusRateHigh as number) < (d.bonusRateLow as number)) d.bonusRateHigh = d.bonusRateLow;
  const ks = between(r, 0.85, 1.15);
  const spend = (v: unknown) => {
    const n = numOf(v);
    if (n === null || n === 0) return v;
    const x = n * ks;
    return Number.isInteger(n) ? Math.max(1, Math.round(x)) : Math.round(x * 100) / 100;
  };
  d.avgSpendPerTxnLow = spend(real.avgSpendPerTxnLow);
  d.avgSpendPerTxnHigh = spend(real.avgSpendPerTxnHigh);
  if (numOf(d.avgSpendPerTxnLow) !== null && numOf(d.avgSpendPerTxnHigh) !== null && (d.avgSpendPerTxnHigh as number) < (d.avgSpendPerTxnLow as number)) d.avgSpendPerTxnHigh = d.avgSpendPerTxnLow;
  // division shares: same total, new split
  const SH = ['divisionShareHG', 'divisionShareCONS', 'divisionShareSPEC', 'divisionShareSVCS', 'divisionShareCharities'];
  const nz = SH.filter((f) => typeof real[f] === 'number' && (real[f] as number) > 0);
  if (nz.length >= 2) {
    const total = nz.reduce((a, f) => a + (real[f] as number), 0);
    const w = nz.map(() => between(r, 0.3, 1));
    const ws = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    nz.forEach((f, i) => {
      if (i === nz.length - 1) d[f] = Math.round((total - acc) * 100) / 100;
      else {
        const v = Math.max(0.05, Math.round(((total * w[i]) / ws) * 20) / 20);
        d[f] = v;
        acc += v;
      }
    });
    if ((d[nz[nz.length - 1]] as number) <= 0) nz.forEach((f) => (d[f] = real[f]));
  }
  // text
  d.promotionDescription = promoDescription(d, real.promotionDescription, rng(`desc|${key}`));
  d.offerShortDescription = shortDescription(d, real.offerShortDescription, rng(`short|${key}`));
  d.usprPrioritySkus = anonSkus(real.usprPrioritySkus);
  d.canPrioritySkus = anonSkus(real.canPrioritySkus);
  if (typeof real.primaryBrand === 'string' && !isNA(real.primaryBrand) && brandPool.length) d.primaryBrand = pick(rng(`brand|${key}`), brandPool);
  // generic free-text notes some sample records carry
  for (const f of ['forecastNotes', 'notes', 'comments', 'resultsNotes', 'offerNotes']) if (typeof d[f] === 'string' && !isNA(d[f])) d[f] = 'Dummy note for the prototype.';
  // identity
  if (typeof real.offerId === 'number') d.offerId = mapId(real.offerId);
  d.offerName = buildName(String(real.offerName ?? ''), real, { fixedPoints: d.fixedPoints, threshold: d.offerThreshold });
  if (typeof real._uid === 'string' && real._uid.startsWith('imp-')) d._uid = `imp-${d.offerId}`;
  if (typeof real.resultsForecastRefNumber === 'number') d.resultsForecastRefNumber = 1000 + Math.floor(rng(`ref|${key}`)() * 900);
  return d;
}

// Names first for every offer (so references to other offers' names resolve), then the rest.
const CODE_FIELDS = ['memberDescriptor', 'activationDescriptor', 'canActivationDescriptor', 'postActivationDescriptor',
  'internalRewardExternalRef', 'transactionExternalRefId', 'deactivationCode'];
const applyCodes = (d: Rec, real: Rec) => {
  for (const f of CODE_FIELDS) if (f in real) d[f] = anonCode(real[f]);
};
const dummyBase: Rec[] = realBase.map((o) => anonOffer(o, `id${o.offerId}`));
// second pass, once every offer name is known (codes can embed other offers' names)
realBase.forEach((o, i) => applyCodes(dummyBase[i], o));
const dummySampleById = new Map<number, Rec>(dummyBase.map((o, i) => [realBase[i].offerId as number, o]));
const PEOPLE = ['Alex Morgan', 'Jordan Lee', 'Taylor Brooks', 'Casey Rivera', 'Riley Chen', 'Morgan Patel', 'Jamie Novak',
  'Avery Santos', 'Drew Kim', 'Quinn Harper', 'Skyler Grant', 'Reese Walker', 'Parker Ellis', 'Rowan Blake'];
const personMap = new Map<string, string>();
const dummyPerson = (name: string) => {
  if (!personMap.has(name)) personMap.set(name, PEOPLE[personMap.size % PEOPLE.length]);
  return personMap.get(name)!;
};
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').toUpperCase();
const baseKeys = new Set<string>();
for (const o of realBase) for (const k of Object.keys(o)) baseKeys.add(k);
function sampleExtras(out: Rec, real: Rec): Rec {
  const p = planFor(real, `id${real.offerId}`);
  for (const k of Object.keys(out)) {
    if (k === '_sampleReason' && typeof out[k] === 'string') out[k] = replaceNames(String(real[k]));
    if (baseKeys.has(k) || k.startsWith('_')) continue;
    const v = real[k];
    if (v === null || v === undefined || v === '') continue;
    switch (k) {
      case 'submittedBy':
        out[k] = String(v).split(/\s*\/\s*/).map(dummyPerson).join(' / ');
        break;
      case 'forecastCreatedBy':
        out[k] = /^[A-Z]{2,3}$/.test(String(v)) ? initials(dummyPerson(String(v))) : v;
        break;
      case 'ppContact':
      case 'memberExclusions':
      case 'fiscalWeek':
      case 'dueDates':
      case 'categoryConcat':
      case 'numberOfDays':
      case 'totalOfferDays':
      case 'startMonth':
      case 'startMonthNumber':
      case 'startYear':
      case 'softLockDate':
        out[k] = v;
        break;
      case 'offerRequestDate':
      case 'skuUploadDate':
        out[k] = typeof v === 'string' && ISO.test(v.slice(0, 10)) ? addDays(v.slice(0, 10), p.delta) : v;
        break;
      case 'disclaimerUSPR':
      case 'disclaimerCAN':
        out[k] = isNA(v) || /^(Consolidated to one|Not participating)$/i.test(String(v))
          ? v
          : `Offer valid ${out.startDate} to ${out.endDate} for loyalty members in stores and online. Points post within 7 days. Terms apply.`;
        break;
      case 'offerCardLinkUS':
      case 'offerCardLinkCAN':
        out[k] = isNA(v) ? v : `https://www.example.${k.endsWith('CAN') ? 'ca' : 'com'}/offers/${String(out.offerName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        break;
      case 'metadataRefNumber':
        out[k] = typeof v === 'number' ? mapMdRefLater(v) : v;
        break;
      case 'resultsForecastRefNumber':
        out[k] = typeof v === 'number' ? 5000 + (v % 1000) : v;
        break;
      case 'locationCode':
        out[k] = typeof v === 'number' ? Number(mapNumber(String(v))) : v;
        break;
      case 'notes':
        out[k] = 'Dummy note: end date moved after the MFP review.';
        break;
      case 'resultsDateUpdated':
        out[k] = String(v).replace(/^(\S+).*$/, '$1 - MFP');
        break;
      case 'jiraTicket':
        out[k] = isNA(v) ? v : `LOM-${1000 + Math.floor(rng(`jira|${v}`)() * 9000)}`;
        break;
      case 'activationDescriptorLength':
        out[k] = typeof out.activationDescriptor === 'string' && !isNA(out.activationDescriptor) ? out.activationDescriptor.length : v;
        break;
      case 'canActivationDescriptorLength':
        out[k] = typeof out.canActivationDescriptor === 'string' && !isNA(out.canActivationDescriptor) ? out.canActivationDescriptor.length : v;
        break;
      default:
        out[k] = anonLoose(k, v, real);
    }
  }
  return out;
}
const pendingMdRefs: Array<[Rec, string, number]> = [];
const mapMdRefLater = (n: number) => n; // replaced after the ref maps exist (see below)
const dummySamples: Rec[] = realSamples.map((s) => {
  const fromBase = typeof s.offerId === 'number' ? dummySampleById.get(s.offerId) : undefined;
  let out: Rec;
  if (fromBase) {
    out = {};
    for (const k of Object.keys(s)) out[k] = k in fromBase && k !== '_import' ? fromBase[k] : s[k];
    out._uid = s._uid;
  } else {
    out = anonOffer(s, `id${s.offerId}`);
    applyCodes(out, s);
  }
  out = sampleExtras(out, s);
  if (typeof s.metadataRefNumber === 'number') pendingMdRefs.push([out, 'metadataRefNumber', s.metadataRefNumber]);
  return out;
});
function anonLoose(k: string, v: unknown, real: Rec): unknown {
  if (typeof v === 'number' && Math.abs(v) >= 100 && !/date|year|id$/i.test(k)) return Math.round(v * planFor(real, `id${real.offerId}`).kAct);
  if (typeof v === 'string' && !isNA(v)) return replaceNames(v);
  return v;
}

// ---------------------------------------------------------------- import meta
const rfRefs = dummyBase.filter((o) => typeof o._import?.excelRfRefNumber === 'number').sort((a, b) => (a.offerId as number) - (b.offerId as number));
const mdRefs = dummyBase.filter((o) => typeof o._import?.excelMetadataRefNumber === 'number').sort((a, b) => (a.offerId as number) - (b.offerId as number));
const rfRefMap = new Map<number, number>();
const mdRefMap = new Map<number, number>();
rfRefs.forEach((o, i) => rfRefMap.set(o._import!.excelRfRefNumber!, 5001 + i));
mdRefs.forEach((o, i) => mdRefMap.set(o._import!.excelMetadataRefNumber!, 7001 + i));
let nextLooseRef = 7001 + mdRefs.length;
const mapMdRef = (n: number) => {
  if (!mdRefMap.has(n)) mdRefMap.set(n, nextLooseRef++);
  return mdRefMap.get(n)!;
};
for (const [rec, key, n] of pendingMdRefs) rec[key] = mapMdRef(n);
for (const d of dummyBase) {
  const m = d._import;
  if (!m) continue;
  const nm: ImportMeta = { ...m };
  if (typeof m.excelRfRefNumber === 'number') nm.excelRfRefNumber = rfRefMap.get(m.excelRfRefNumber);
  if (typeof m.excelMetadataRefNumber === 'number') nm.excelMetadataRefNumber = mdRefMap.get(m.excelMetadataRefNumber);
  const fis = fiscalLookup(d);
  if (fis && nm.fiscal) nm.fiscal = { fy: String(fis.fy), fm: String(fis.fm), fw: String(fis.fw) };
  d._import = nm;
}

// ---------------------------------------------------------------- snapshots
function fmtNum(x: number, dec: number, grouping: boolean): string {
  return sig12(x).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grouping });
}
function mimic(t: string, v: number, fmt: Fmt): string {
  const m = /\d[\d,]*(?:\.\d+)?|\.\d+/.exec(t);
  if (!m) return t;
  const core = m[0];
  const dot = core.indexOf('.');
  const dec = dot >= 0 ? core.length - dot - 1 : 0;
  const origAbs = Math.abs(Number(core.replace(/,/g, '')));
  const pct = t.includes('%');
  const grouping = pct || core.includes(',') || (fmt !== 'int' && origAbs < 1000);
  const x = Math.abs(pct ? v * 100 : v);
  const newCore = fmtNum(x, dec, grouping);
  let prefix = t.slice(0, m.index);
  let suffix = t.slice(m.index + core.length);
  const paren = /\(/.test(prefix);
  prefix = prefix.replace(/[-(]/g, '');
  suffix = suffix.replace(/\)/g, '');
  const isNeg = v < 0 && Number(newCore.replace(/,/g, '')) !== 0;
  if (isNeg) {
    const ws = /^\s*/.exec(prefix)![0];
    prefix = ws + (paren ? '(' : '-') + prefix.slice(ws.length);
    if (paren) suffix = suffix.replace(/(\s*)$/, ')$1');
  }
  return prefix + newCore + suffix;
}
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
function shiftMdy(t: string, delta: number): string {
  const m = MDY.exec(t.trim());
  if (!m) return t;
  const iso = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const s = addDays(iso, delta);
  return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}/${s.slice(0, 4)}`;
}
function matchedDummy(t: string, dv: XVal, fmt: Fmt): string {
  if (isErr(dv)) return dv.error;
  if (typeof dv === 'string') return dv;
  if (fmt === 'date') return mdyyyy(dv);
  if (fmt === 'text' || fmt === 'status' || !/\d/.test(t)) return formatXVal(dv, fmt);
  return mimic(t, dv, fmt);
}
const otherTexts = new Map<string, number>();
const lostSamples: string[] = [];
function mismatchedDummy(t: string, rv: XVal, dv: XVal, fmt: Fmt, k: number, delta: number): string {
  const tt = t.trim();
  if (tt === '' || /^#/.test(tt) || /^(null|TBD|N\/A|NA|Yes|No|-|Y|N|USD|CAD)$/i.test(tt)) return t;
  if (nameMap.has(tt)) return nameMap.get(tt)!;
  if (MDY.test(tt)) return shiftMdy(tt, delta);
  const ex = parseExcelCell(tt);
  if (typeof ex === 'number') {
    if (typeof rv === 'number' && typeof dv === 'number' && rv !== 0) return mimic(t, dv * (ex / rv), fmt);
    if (/^\d{4,}$/.test(tt) && fmt === 'int') return mimic(t, Math.round(ex * k), fmt);
    return mimic(t, ex * k, fmt);
  }
  otherTexts.set(tt, (otherTexts.get(tt) ?? 0) + 1);
  const named = replaceNames(tt);
  return named !== tt ? named : typeof dv === 'string' ? dv : t;
}
const realByIdAll = realById;
const dummyByOld = new Map<number, Rec>(realBase.map((o, i) => [o.offerId as number, dummyBase[i]]));
function rebuild(
  snap: Snapshot,
  fmtOf: (L: string) => Fmt,
  compute: (o: Rec) => Record<string, XVal>,
  special?: (L: string, real: Rec, dummy: Rec, t: string) => string | undefined,
) {
  let kept = 0;
  let flips = 0;
  let lost = 0;
  const rows = snap.rows.map((row) => {
    const real = realByIdAll.get(row.offerId)!;
    const dummy = dummyByOld.get(row.offerId)!;
    const rc = compute(real);
    const dc = compute(dummy);
    const p = plans.get(real)!;
    const v = row.v.map((t, i) => {
      const L = snap.columns[i];
      const sp = special?.(L, real, dummy, t);
      if (sp !== undefined) return sp;
      const fmt = fmtOf(L);
      const was = compareCell(t, rc[L] ?? '', fmt).match;
      const out = was ? matchedDummy(t, dc[L] ?? '', fmt) : mismatchedDummy(t, rc[L] ?? '', dc[L] ?? '', fmt, p.kAct, p.delta);
      const now = compareCell(out, dc[L] ?? '', fmt).match;
      if (was && !now) {
        lost++;
        lostSamples.push(`${L} t=${JSON.stringify(t)} real=${JSON.stringify(rc[L])} dummy=${JSON.stringify(dc[L])} out=${JSON.stringify(out)} fmt=${fmt}`);
      }
      else if (!was && now) flips++;
      else kept++;
      return out;
    });
    return { offerId: mapId(row.offerId), row: row.row, v };
  });
  return { snap: { ...snap, rows }, kept, flips, lost };
}
const rfFmt = (L: string) => (RF_BY_LETTER[L]?.format ?? 'text') as Fmt;
const mdFmtMap = new Map(MD_REGISTRY.map((e) => [e.letter, e.format as Fmt]));
const mdFmt = (L: string) => mdFmtMap.get(L) ?? 'text';
const rfRes = rebuild(realRf, rfFmt, (o) => computeRfCells(o, AS_OF), (L, real, dummy) => {
  if (L === 'A') {
    const ref = dummy._import?.excelRfRefNumber;
    return ref !== undefined ? String(ref) : String(dummy.offerId);
  }
  return undefined;
});
const mdRes = rebuild(realMd, mdFmt, (o) => computeMdCells(o, AS_OF, o._import));

// ---------------------------------------------------------------- import report
const dRf = rfRes.snap;
const dMd = mdRes.snap;
const cellOf = (snap: Snapshot, newId: number, L: string): string | undefined => {
  const i = snap.columns.indexOf(L);
  const row = snap.rows.find((r) => r.offerId === newId);
  return i >= 0 && row ? row.v[i] : undefined;
};
const realCellOf = (snap: Snapshot, oldId: number, L: string): string | undefined => {
  const i = snap.columns.indexOf(L);
  const row = snap.rows.find((r) => r.offerId === oldId);
  return i >= 0 && row ? row.v[i] : undefined;
};
const plainNum = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());
function rawStr(v: XVal | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'number') return String(Number(v.toPrecision(6)));
  return isErr(v) ? v.error : String(v);
}
function txIssue(i: ImportIssue): ImportIssue {
  const out: ImportIssue = { ...i };
  const real = i.offerId !== null ? realById.get(i.offerId) : undefined;
  const dummy = i.offerId !== null ? dummyByOld.get(i.offerId) : undefined;
  if (i.offerId !== null) out.offerId = mapId(i.offerId);
  if (i.offerIds) out.offerIds = i.offerIds.map(mapId);
  out.offerName = replaceNames(i.offerName);
  out.excelValue = replaceNames(i.excelValue);
  out.valueUsed = replaceNames(i.valueUsed);
  if (real && dummy) {
    const newId = dummy.offerId as number;
    const fd = /^([A-Z]{1,2}) \(R&F\) \/ ([A-Z]{1,2}) \(Metadata\)$/.exec(i.column);
    if (fd) {
      const oldRf = realCellOf(realRf, i.offerId!, fd[1])?.trim();
      const oldMd = realCellOf(realMd, i.offerId!, fd[2])?.trim();
      const nRf = cellOf(dRf, newId, fd[1])?.trim() ?? '';
      const nMd = cellOf(dMd, newId, fd[2])?.trim() ?? '';
      out.excelValue = `R&F ${nRf} | Metadata ${nMd}`;
      out.valueUsed = i.valueUsed.trim() === oldRf ? nRf : i.valueUsed.trim() === oldMd ? nMd : mimic(i.valueUsed, Number(parseExcelCell(nRf)) || 0, 'num0');
    } else if (/^[A-Z]{1,2}$/.test(i.column)) {
      const L = i.column;
      const isRf = /R&F/.test(i.file);
      const snapReal = isRf ? realRf : realMd;
      const snapDummy = isRf ? dRf : dMd;
      const oldCell = realCellOf(snapReal, i.offerId!, L)?.trim();
      if (oldCell !== undefined && oldCell === i.excelValue.trim() && !nameMap.has(oldCell)) out.excelValue = cellOf(snapDummy, newId, L)?.trim() ?? out.excelValue;
      const dc = isRf ? computeRfCells(dummy, AS_OF) : computeMdCells(dummy, AS_OF, dummy._import);
      if (plainNum(i.valueUsed)) out.valueUsed = rawStr(dc[L]);
      else if (typeof parseExcelCell(i.valueUsed) === 'number' && /[\d]/.test(i.valueUsed)) out.valueUsed = mimic(i.valueUsed, Number(dc[L]) || 0, 'num0');
    }
  }
  let msg = replaceNames(i.message);
  msg = msg.replace(/Offer IDs? ([\d, ]*\d)/g, (_, list: string) => `Offer ID${list.includes(',') ? 's' : ''} ${list.split(/\s*,\s*/).map((x) => String(mapId(Number(x)))).join(', ')}`);
  msg = msg.replace(/Ref Nbr (\d+)/g, (_, n: string) => `Ref Nbr ${mapMdRef(Number(n))}`);
  if (i.excelValue !== out.excelValue && i.excelValue.length >= 2 && /\d/.test(i.excelValue)) msg = msg.split(i.excelValue).join(out.excelValue);
  if (i.valueUsed !== out.valueUsed && i.valueUsed.length >= 2 && /\d/.test(i.valueUsed)) msg = msg.split(i.valueUsed).join(out.valueUsed);
  out.message = msg;
  return out;
}
const dummyIssues = realReport.issues.map(txIssue);
const dummyReport = {
  ...realReport,
  files: {
    rf: 'Dummy data shaped like the Excel tab "LIVE - Results and Forecast" (real file not shipped)',
    metadata: 'Dummy data shaped like the Excel Metadata "Master Sheet" (real file not shipped)',
  },
  dummyData: true,
  filesDisagreeOfferNames: ((realReport.filesDisagreeOfferNames as string[]) ?? []).map(replaceNames),
  issues: dummyIssues,
};

// ---------------------------------------------------------------- reference samples
function anonReferenceRecord(rec: Record<string, unknown>, parentReal: Rec | undefined, parentDummy: Rec | undefined): Record<string, unknown> {
  const p = parentReal ? plans.get(parentReal) : undefined;
  const out: Record<string, unknown> = {};
  const kAct = p?.kAct ?? 1;
  const kBm = p?.kBm ?? 1;
  const ptsRatio = parentReal && parentDummy && numOf(parentReal.fixedPoints) && numOf(parentDummy.fixedPoints) ? numOf(parentDummy.fixedPoints)! / numOf(parentReal.fixedPoints)! : 1;
  for (const [k, v] of Object.entries(rec)) {
    const kl = k.toLowerCase();
    if (typeof v === 'string' && /descriptor|ref id|external ref|code/.test(kl)) out[k] = anonCode(v);
    else if (typeof v === 'string' && /description/.test(kl) && parentDummy) out[k] = promoDescription(parentDummy, v, rng(`refdesc|${v}`));
    else if (typeof v === 'string' && ISO.test(v) && p) out[k] = addDays(v, p.delta);
    else if (typeof v === 'number' && /^activations$/.test(kl)) out[k] = Math.round(v * kAct);
    else if (typeof v === 'number' && /bonused members/.test(kl)) out[k] = Math.round(v * kBm);
    else if (typeof v === 'number' && /bonus pts issued|bonus points redeemable|redeemable \$/.test(kl)) out[k] = Math.round(v * kBm * ptsRatio);
    else if (typeof v === 'number' && /fixed amounts/.test(kl) && parentDummy && numOf(parentDummy.fixedPoints) !== null) out[k] = numOf(parentDummy.fixedPoints);
    else if (typeof v === 'string' && /threshold \(\$\)/.test(kl) && parentDummy && numOf(parentDummy.offerThreshold) !== null) {
      const t2 = numOf(parentDummy.offerThreshold)!;
      out[k] = /\(\d+\)/.test(v) ? `${t2 - 1} (${t2})` : String(t2);
    } else if (typeof v === 'string') out[k] = replaceNames(v);
    else out[k] = v;
  }
  const act = numOf(out['Activations']);
  const bmv = numOf(out['Bonused Members']);
  if ('Bonus Rate' in out && act && bmv !== null) out['Bonus Rate'] = bmv / act;
  return out;
}
const realByName = new Map<string, Rec>([...realBase, ...realSamples].map((o) => [String(o.offerName ?? ''), o]));
const dummyOfReal = (r: Rec | undefined) => (r && typeof r.offerId === 'number' ? dummyByOld.get(r.offerId) : undefined);
// names that appear only in reference data
for (const sec of ['groupedChildrenSamples', 'evergreenOffers', 'inspireSubmissionForms']) {
  JSON.stringify(realReference[sec], (_k, v) => {
    if (typeof v === 'string') {
      const m = /^(\d{4,8}_[A-Z0-9$&_.\-]+?)(?: - Offer \d+)?$/i.exec(v);
      if (m && !nameMap.has(m[1])) buildName(m[1], realByName.get(m[1]), undefined);
    }
    return v;
  });
}
const reference: Record<string, unknown> = JSON.parse(JSON.stringify(realReference));
{
  const g = realReference.groupedChildrenSamples as Record<string, Array<Record<string, unknown>>>;
  const ng: Record<string, Array<Record<string, unknown>>> = {};
  for (const [name, kids] of Object.entries(g)) {
    const pr = realByName.get(name);
    const pd = dummyOfReal(pr);
    ng[replaceNames(name)] = kids.map((kid) => anonReferenceRecord(kid, pr, pd));
  }
  reference.groupedChildrenSamples = ng;
  reference.evergreenOffers = (realReference.evergreenOffers as Array<Record<string, unknown>>).map((e) => {
    const pr = realByName.get(String(e['Promotion Name'] ?? ''));
    return anonReferenceRecord(e, pr, dummyOfReal(pr));
  });
  const forms = realReference.inspireSubmissionForms as Record<string, { rows: unknown[][] }>;
  const nf: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(forms)) {
    const exReal = realByName.get(String(f.rows[0]?.[2] ?? ''));
    const exDummy = dummyOfReal(exReal);
    nf[k] = {
      ...f,
      rows: f.rows.map((row) =>
        row.map((c, ci) => {
          const fid = row[5];
          if (ci === 2 && exDummy && typeof fid === 'string' && fid in exDummy) return exDummy[fid];
          if (typeof c !== 'string') {
            if (ci === 2 && typeof c === 'number' && /fixed amount/i.test(String(row[0])) && exDummy) return numOf(exDummy.fixedPoints) ?? c;
            return c;
          }
          if (ci === 2 && /description/i.test(String(row[0])) && exDummy) return promoDescription(exDummy, c, rng(`form|${k}`));
          if (ci === 2 && /threshold \(\$\)/i.test(String(row[0])) && exDummy) return String(exDummy.offerThreshold ?? c);
          if (ci === 2 && /disclaimer/i.test(String(row[0])) && !isNA(c) && !/^Consolidated/i.test(c))
            return `Offer valid ${exDummy?.startDate ?? ''} to ${exDummy?.endDate ?? ''} for loyalty members. Activate before purchase to earn bonus points. Terms apply.`;
          return ci >= 2 && ci !== 3 && /[A-Z0-9]{5,}/.test(c) ? anonCode(replaceNames(c)) : replaceNames(c);
        }),
      ),
    };
  }
  reference.inspireSubmissionForms = nf;
}

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'offers.base.json'), JSON.stringify(dummyBase));
fs.writeFileSync(path.join(OUT, 'excelSnapshot.rf.json'), JSON.stringify(dRf));
fs.writeFileSync(path.join(OUT, 'excelSnapshot.metadata.json'), JSON.stringify(dMd));
fs.writeFileSync(path.join(OUT, 'importReport.json'), JSON.stringify(dummyReport, null, 1));
fs.writeFileSync(path.join(ROOT, 'src/data/sampleOffers.json'), JSON.stringify(dummySamples, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'src/data/reference.json'), JSON.stringify(reference, null, 2) + '\n');
fs.writeFileSync(
  path.join(PRIV, 'dummyMaps.json'),
  JSON.stringify({ ids: Object.fromEntries(idMap), names: Object.fromEntries(nameMap) }, null, 1),
);

// ---------------------------------------------------------------- verify
function check(base: Rec[], rf: Snapshot, md: Snapshot, issues: ImportIssue[]) {
  const metaOf = new Map(base.map((o) => [o.offerId as number, o._import]));
  const rfCols = Object.keys(RF_BY_LETTER).slice(Object.keys(RF_BY_LETTER).indexOf('S')).map((L) => ({ letter: L, header: L, format: rfFmt(L) }));
  const mdCols = MD_REGISTRY.filter((e) => e.band !== 'MD_BASICS').map((e) => ({ letter: e.letter, header: e.header, format: e.format as Fmt }));
  const byId = new Map(base.map((o) => [o.offerId as number, o]));
  const a = runCheck({ offers: base, snapshot: rf, columns: rfCols, compute: (o) => computeRfCells(o, AS_OF), isChanged: () => false, issues });
  const b = runCheck({
    offers: base, snapshot: md, columns: mdCols, compute: (o) => computeMdCells(o, AS_OF, (o as Rec)._import), isChanged: () => false, issues,
    extraReason: (id, L, t) => metadataReason(byId.get(id), !!metaOf.get(id)?.inExcelRfTab, t, L),
  });
  return { rf: { cells: a.cellsCompared, match: a.matches, reasons: a.byReason }, md: { cells: b.cellsCompared, match: b.matches, reasons: b.byReason } };
}
const before = check(realBase, realRf, realMd, realReport.issues);
const after = check(dummyBase, dRf, dMd, dummyIssues);
console.log('R&F snapshot  kept/flips/lost:', rfRes.kept, rfRes.flips, rfRes.lost);
console.log('Meta snapshot kept/flips/lost:', mdRes.kept, mdRes.flips, mdRes.lost);
console.log('BEFORE', JSON.stringify(before));
console.log('AFTER ', JSON.stringify(after));
console.log('Lost:\n' + lostSamples.join('\n'));
console.log('Unclassified text cells:', JSON.stringify([...otherTexts.entries()].slice(0, 30)));
console.log(`Offers ${dummyBase.length}, IDs ${FIRST_ID}..${FIRST_ID + idSet.length - 1}, names mapped ${nameMap.size}, tokens ${tokenMap.size}`);
