// v3 Package C: values, column order and view presets for the Results & Forecast
// Grid tab. Everything reads the column registry (C3b).
import type { XVal } from './excel';
import { serial } from './excel';
import { formatXVal } from './excelFormat';
import { computeRfCells, totalOfferDaysOf } from './rfEngine';
import { computeMdCells } from './mdEngine';
import { forecastNeeded, includeForResultsForecast, rfRoundTrip } from './calculations';
import { RF_REGISTRY, CALENDAR_BAND, type RegistryEntry } from './forecastColumnRegistry';
import { isNoValue } from './format';
import type { ImportMeta, OfferRecord } from './types';

/** Grid columns in display order: A and J first (frozen), then Excel order, then CALENDAR. */
export const GRID_ENTRIES: RegistryEntry[] = [
  RF_REGISTRY.find((e) => e.letter === 'A')!,
  RF_REGISTRY.find((e) => e.letter === 'J')!,
  ...RF_REGISTRY.filter((e) => e.letter !== 'A' && e.letter !== 'J'),
  ...CALENDAR_BAND,
];

/** Calendar columns that the shared Excel files do not include. */
export const NOT_IN_SHARED_FILES = new Set(['cal:DI', 'cal:DZ', 'cal:DC', 'cal:CS']);

function num(v: unknown): XVal {
  if (isNoValue(v)) return '';
  return typeof v === 'number' ? v : String(v);
}

/** The value of one registry column for an offer at an as-of date. */
export function gridValue(
  e: RegistryEntry,
  o: OfferRecord,
  asOf: Date,
  meta?: ImportMeta,
): XVal {
  if (e.source === 'Metadata') return computeMdCells(o, asOf, meta)[e.letter] ?? '';
  if (e.source === 'R&F tab') {
    if (e.letter === 'A') return typeof o.offerId === 'number' ? o.offerId : String(o.offerId ?? '');
    return computeRfCells(o, asOf)[e.letter as keyof ReturnType<typeof computeRfCells>];
  }
  switch (e.letter) {
    case 'DH':
      return serial(o.forecastDate) ?? (isNoValue(o.forecastDate) ? '' : String(o.forecastDate));
    case 'DI':
    case 'DZ':
    case 'DC':
    case 'CS':
      return isNoValue(o[e.fieldId!]) ? '' : String(o[e.fieldId!]);
    case 'DY':
      return forecastNeeded(o);
    case 'DJ':
      return totalOfferDaysOf(o) ?? '';
    case 'DK':
    case 'DL':
      return num(o[e.fieldId!]);
    case 'DS':
    case 'DT':
    case 'DU':
    case 'DV':
    case 'DW':
    case 'DX':
      return rfRoundTrip(o)[e.fieldId as keyof ReturnType<typeof rfRoundTrip>];
    case 'CW':
      return includeForResultsForecast(o);
    case 'CX':
      return meta?.excelRfRefNumber ?? '';
    case 'CV':
      return meta?.excelMetadataRefNumber ?? '';
    default:
      return '';
  }
}

const keys = (letters: string[], prefix = 'rf') => letters.map((l) => `${prefix}:${l}`);
const RF_ORDER = GRID_ENTRIES.filter((e) => e.source === 'R&F tab').map((e) => e.letter);
const between = (from: string, to: string) => {
  const all = RF_REGISTRY.map((e) => e.letter);
  return all.slice(all.indexOf(from), all.indexOf(to) + 1);
};
const BASICS_ORDERED = ['A', 'J', ...between('B', 'N').filter((l) => l !== 'J')];

export interface ViewPreset {
  name: string;
  visible: string[];
}

/** C3 saved views (built in). "Excel full" is the default. */
export const RF_PRESETS: ViewPreset[] = [
  {
    name: 'Excel full (A to BZ)',
    visible: [...keys(RF_ORDER), ...CALENDAR_BAND.filter((e) => !e.hiddenByDefault).map((e) => e.key)],
  },
  {
    name: 'Calendar forecast fields',
    visible: [
      ...keys(['A', 'J', 'C']),
      ...keys(['DH', 'DI', 'DZ', 'DY', 'DJ', 'DK', 'DL'], 'cal'),
      ...keys(between('AF', 'AK')),
      ...keys(['DS', 'DT', 'DU', 'DV', 'DW', 'DX'], 'cal'),
    ],
  },
  {
    name: 'Business summary',
    visible: keys(['A', 'J', 'C', 'B', 'D', 'E', 'F', 'G', 'I', 'K', 'L', 'O', 'P', 'Q', 'R', 'AL', 'AM', 'AP', 'AZ', 'BI', 'BZ']),
  },
  { name: 'Results only', visible: keys([...BASICS_ORDERED, ...between('O', 'AE')]) },
  { name: 'Forecast only', visible: keys([...BASICS_ORDERED, ...between('AF', 'BL')]) },
  { name: 'WBR', visible: keys(['A', 'J', 'C', 'B', ...between('BM', 'BZ')]) },
];

/** Statuses counted as "Completed or later" for the Results missing filter. */
export const COMPLETED_OR_LATER = new Set(['Completed', 'Completed - Data Final', 'Pending Points Upload']);

/** Header text used on screen and in exports (A shows the Offer ID). */
export function displayHeader(e: RegistryEntry): string {
  return e.source === 'R&F tab' && e.letter === 'A' ? 'Offer ID' : e.header;
}

/**
 * C3 export: Excel header text, then the column letter as a second header row,
 * then the values exactly as displayed (the same text as Excel).
 */
export function buildExportTable(
  entries: RegistryEntry[],
  rows: OfferRecord[],
  asOf: Date,
  metaOf: (uid: string | undefined) => ImportMeta | undefined,
): { header: string[]; letters: string[]; data: string[][] } {
  return {
    header: entries.map(displayHeader),
    letters: entries.map((e) => e.letter),
    data: rows.map((o) => entries.map((e) => formatXVal(gridValue(e, o, asOf, metaOf(o._uid)), e.format))),
  };
}
