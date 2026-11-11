// v3 C3b: one entry per column shown on the Results & Forecast page. The Grid
// tab, Metadata view, How tab, exports and the Check tab all read this registry,
// so a column cannot appear in one place and be missing from another.
import type { TagKind } from '@/components/TagPill';
import type { Fmt } from './excelFormat';

export type RegistrySource = 'R&F tab' | 'Calendar main tab' | 'Metadata';
export type RegistryTab = 'grid' | 'metadata';
export type Band =
  | 'basics'
  | 'RESULTS'
  | 'FORECAST'
  | 'WBR'
  | 'CALENDAR'
  | 'MD_BASICS'
  | 'MD_RESULTS'
  | 'MD_FORECAST'
  | 'MD_OTHER'
  | 'MD_MULTI'
  | 'MD_PRORATED';

/** Extra tags beyond TagPill kinds that this page shows. */
export type RegistryTag = TagKind | 'Copy of R&F' | 'From Metadata file';

export interface RegistryEntry {
  /** Stable key: "rf:S", "cal:DH", "md:CP". */
  key: string;
  source: RegistrySource;
  /** Excel column letter in its own file. */
  letter: string;
  /** Exact Excel header text (trimmed, whitespace collapsed). */
  header: string;
  tab: RegistryTab;
  band: Band;
  tag: RegistryTag;
  format: Fmt;
  /** Form field id for inputs, when the value comes straight from the offer. */
  fieldId?: string;
  /** Plain-English meaning. */
  meaning: string;
  /** Formula in words (blank for plain inputs). */
  words?: string;
  /** The Excel formula. */
  excel?: string;
  /** "Source: Step n, field name" for inputs. */
  inputSource?: string;
  /** Known caveat shown with an info icon. */
  caveat?: string;
  /** For Calendar columns shown through their R&F twin. */
  twinOf?: string;
  /** Hidden by default in every preset. */
  hiddenByDefault?: boolean;
}

const rf = (
  letter: string,
  header: string,
  band: Band,
  tag: RegistryTag,
  format: Fmt,
  meaning: string,
  extra: Partial<RegistryEntry> = {},
): RegistryEntry => ({
  key: `rf:${letter}`,
  source: 'R&F tab',
  letter,
  header,
  tab: 'grid',
  band,
  tag,
  format,
  meaning,
  ...extra,
});

/** R&F tab, columns A..BZ (78), in Excel order with the exact Excel header text. */
export const RF_REGISTRY: RegistryEntry[] = [
  rf('A', 'Ref Number', 'basics', 'Auto-generated', 'int', 'Offer ID. Replaces the hand-typed Ref Number (Excel column A).', {
    fieldId: 'offerId',
    caveat: 'Replaces the hand-typed Ref Number (Excel column A).',
  }),
  rf('B', 'Dashboard Mo. (reporting)', 'basics', 'Typed', 'text', 'Month(s) the offer is reported in.', { fieldId: 'dashboardMonth', inputSource: 'Source: Step 1, Dashboard Mo. (reporting)' }),
  rf('C', 'Status', 'basics', 'Dropdown', 'status', 'Build status of the offer.', { fieldId: 'buildStatus', inputSource: 'Source: Step 2, Build Status' }),
  rf('D', 'Start Date', 'basics', 'Typed', 'date', 'First day of the offer.', { fieldId: 'startDate', inputSource: 'Source: Step 1, Start Date' }),
  rf('E', 'End Date', 'basics', 'Typed', 'date', 'Last day of the offer.', { fieldId: 'endDate', inputSource: 'Source: Step 1, End Date' }),
  rf('F', 'Promo Days', 'basics', 'Calculated', 'int', 'Number of days the offer runs.', { words: 'End Date minus Start Date plus 1.', excel: '=E-D+1' }),
  rf('G', 'Category', 'basics', 'Dropdown', 'text', 'Loyalty Planning Category.', { fieldId: 'category', inputSource: 'Source: Step 2, Loyalty Planning Category' }),
  rf('H', 'Sub-Category', 'basics', 'Dropdown', 'text', 'Loyalty Planning Sub-Category.', { fieldId: 'subCategory', inputSource: 'Source: Step 2, Loyalty Planning Sub-Category' }),
  rf('I', 'Loyalty offer tiering', 'basics', 'Dropdown', 'text', 'Offer tier.', { fieldId: 'offerTiering', inputSource: 'Source: Step 2, Loyalty offer tiering' }),
  rf('J', 'Offer Name', 'basics', 'Typed', 'text', 'Offer name.', { fieldId: 'offerName', inputSource: 'Source: Step 2, Offer Name' }),
  rf('K', 'Markets', 'basics', 'Dropdown', 'text', 'Country / markets.', { fieldId: 'country', inputSource: 'Source: Step 2, Country / Markets' }),
  rf('L', 'Offer Design', 'basics', 'Dropdown', 'text', 'Offer design.', { fieldId: 'offerDesign', inputSource: 'Source: Step 5, Offer Design' }),
  rf('M', 'Offer reward (Multiplier - 2X / 3X, etc.)', 'basics', 'Dropdown', 'text', 'Points multiplier.', { fieldId: 'multiplier', inputSource: 'Source: Step 3, Offer reward (Multiplier)' }),
  rf('N', 'Offer reward (fixed amounts - pts)', 'basics', 'Typed', 'int', 'Fixed points reward. "N/A" stays text.', { fieldId: 'fixedPoints', inputSource: 'Source: Step 3, Offer reward (fixed amounts - pts)' }),

  rf('O', 'Audience Size', 'RESULTS', 'Typed', 'num0', 'Members eligible for the offer. Typed after the offer runs.', { fieldId: 'audienceSize', inputSource: 'Source: Step 9, Audience Size', words: 'The offer value, or 0 when blank.' }),
  rf('P', 'Activations', 'RESULTS', 'Typed', 'num0', 'Members who activated.', { fieldId: 'activations', inputSource: 'Source: Step 9, Activations', words: 'The offer value, or 0 when blank.' }),
  rf('Q', 'Bonused members', 'RESULTS', 'Typed', 'num0', 'Members who earned the bonus.', { fieldId: 'bonusedMembers', inputSource: 'Source: Step 9, Bonused members', words: 'The offer value, or 0 when blank.' }),
  rf('R', 'Bonus Pts Issued', 'RESULTS', 'Typed', 'num2opt', 'Bonus points issued.', { fieldId: 'bonusPtsIssued', inputSource: 'Source: Step 9, Bonus Pts Issued', words: 'The offer value, or 0 when blank.' }),
  rf('S', 'Limited Time Bonus points outstanding during promo', 'RESULTS', 'Calculated', 'num0', 'Points given up front on a Limited Time Bonus Offer.', { words: 'Limited Time Bonus Offer only: fixed points x activations.', excel: '=IF(L="Limited Time Bonus Offer",N*P,"")' }),
  rf('T', 'Limited Time Bonus points removed', 'RESULTS', 'Calculated', 'num0', 'Points taken back after a Limited Time Bonus Offer.', {
    words: 'Only when the build status is exactly "Completed" and the design is Limited Time Bonus Offer: outstanding points minus points issued.',
    excel: '=IF(AND(C="Completed",L="Limited Time Bonus Offer"),S-R,"")',
    caveat: 'Uses the build status "Completed" only, not "Completed - Data Final".',
  }),
  rf('U', 'Bonus rate', 'RESULTS', 'Calculated', 'pct1', 'Share of activated members who earned the bonus.', { words: 'Bonused members divided by activations.', excel: '=IFERROR(Q/P,"null")' }),
  rf('V', '1000', 'RESULTS', 'Fixed number', 'dec1', 'Dollars per 1,000 points.', {
    fieldId: 'redemptionConversion',
    words: 'The offer\'s $ per 1,000 points (2 since April 2024).',
    caveat: 'Excel\'s header for this column is the number 1000 (the points unit); the cell holds the $ value.',
  }),
  rf('W', 'Bonus point calculation', 'RESULTS', 'Calculated', 'num0', 'Bonus points per unit used in the points maths.', {
    words: 'Multiplier: the number before "X" minus 1 (10X gives 9). Otherwise the fixed points ("N/A" stays text).',
    excel: '=IF(L="Multiplier",LEFT(M,LEN(M)-1)-1,N)',
  }),
  rf('X', 'Base pts per $', 'RESULTS', 'Fixed number', 'int', 'Base points earned per $1.', { fieldId: 'basePtsPerDollar', words: 'The offer\'s base points per $1 (10 since April 2024).' }),
  rf('Y', 'Bonused sales', 'RESULTS', 'Calculated', 'cur0', 'Sales worked back from the bonus points (Multiplier only).', { words: 'Multiplier only: points issued / bonus point calculation / base points per $. Otherwise "TBD".', excel: '=IF(L="Multiplier",R/W/X,"TBD")' }),
  rf('Z', 'Base points', 'RESULTS', 'Calculated', 'num2', 'Base points on the bonused sales.', { words: 'Base points per $ x bonused sales.', excel: '=IFERROR(X*Y,"TBD")' }),
  rf('AA', 'Base points redeemable $ (100%)', 'RESULTS', 'Calculated', 'cur0', 'Dollar value of the base points.', { words: 'Base points / 1,000 x $ per 1,000 points.', excel: '=IFERROR(Z/1000*V,"TBD")' }),
  rf('AB', 'Bonus points redeemable $ (100%)', 'RESULTS', 'Calculated', 'cur0', 'Dollar value of the bonus points issued.', { words: 'Points issued / 1,000 x $ per 1,000 points.', excel: '=IFERROR(R/1000*V,"TBD")' }),
  rf('AC', 'Assumed redemption rate', 'RESULTS', 'Calculated', 'pct0', 'Share of points expected to be redeemed.', {
    words: '100% for Points donations, Extra Entries and Limited Time Bonus Offer; otherwise 88% from 10/1/2025, else 85%.',
    excel: '=IF(L="Points donations",1,IF(L="Extra Entries",1,IF(L="Limited Time Bonus Offer",1,IF(D>=DATE(2025,10,1),0.88,0.85))))',
  }),
  rf('AD', 'Bonus points redeemable $ (breakage if applicable)', 'RESULTS', 'Calculated', 'cur0', 'Bonus points dollars after breakage.', { words: 'Assumed redemption rate x bonus points redeemable $.', excel: '=AC*AB' }),
  rf('AE', 'Spend per bonused members (per day) - uses total (not unique)', 'RESULTS', 'Calculated', 'cur2', 'Bonused sales per bonused member.', {
    words: 'Bonused sales divided by bonused members.',
    excel: '=IFERROR(Y/Q,"TBD")',
    caveat: 'The header says "per day" but Excel does not divide by days.',
  }),

  rf('AF', 'Activation - Low', 'FORECAST', 'Calculated', 'num0', 'Forecast activations, low case.', { words: 'Step 7 activation by day (Low) x total offer days, or 0.', inputSource: 'Source: Step 7, Activation by day - Low' }),
  rf('AG', 'Activation - High', 'FORECAST', 'Calculated', 'num0', 'Forecast activations, high case.', { words: 'Step 7 activation by day (High) x total offer days, or 0.', inputSource: 'Source: Step 7, Activation by day - High' }),
  rf('AH', 'Bonus rate - Low', 'FORECAST', 'Typed', 'pct0', 'Forecast bonus rate, low case.', { fieldId: 'bonusRateLow', inputSource: 'Source: Step 7, Bonus rate - Low', words: 'The offer value, or 0 when blank.' }),
  rf('AI', 'Bonus rate - High', 'FORECAST', 'Typed', 'pct0', 'Forecast bonus rate, high case.', { fieldId: 'bonusRateHigh', inputSource: 'Source: Step 7, Bonus rate - High', words: 'The offer value, or 0 when blank.' }),
  rf('AJ', 'Avg Spend/txn - Low', 'FORECAST', 'Typed', 'num0', 'Forecast average spend per transaction, low case.', { fieldId: 'avgSpendPerTxnLow', inputSource: 'Source: Step 7, Avg Spend/txn - Low', words: 'The offer value, or 0 when blank.' }),
  rf('AK', 'Avg spend/txn - High', 'FORECAST', 'Typed', 'num0', 'Forecast average spend per transaction, high case.', { fieldId: 'avgSpendPerTxnHigh', inputSource: 'Source: Step 7, Avg spend/txn - High', words: 'The offer value, or 0 when blank.' }),
  rf('AL', 'Activation - Average', 'FORECAST', 'Calculated', 'num0', 'Average of low and high activations.', { words: 'Average of AF and AG.', excel: '=IFERROR(AVERAGE(AF,AG),"null")' }),
  rf('AM', 'Bonus rate - Average', 'FORECAST', 'Calculated', 'pct1', 'Average of low and high bonus rates.', { words: 'Average of AH and AI.', excel: '=IFERROR(AVERAGE(AH,AI),"null")' }),
  rf('AN', 'Bonused members - Low', 'FORECAST', 'Calculated', 'num0', 'Forecast bonused members, low case.', { words: 'Activation Low x bonus rate Low.', excel: '=AF*AH' }),
  rf('AO', 'Bonused members - High', 'FORECAST', 'Calculated', 'num0', 'Forecast bonused members, high case.', { words: 'Activation High x bonus rate High.', excel: '=AG*AI' }),
  rf('AP', 'Bonused members - Average', 'FORECAST', 'Calculated', 'num0', 'Average forecast bonused members.', { words: 'Average of AN and AO.', excel: '=AVERAGE(AN,AO)' }),
  rf('AQ', 'Spend per txn - Avg', 'FORECAST', 'Calculated', 'cur0', 'Average forecast spend per transaction.', { words: 'Average of AJ and AK.', excel: '=AVERAGE(AJ,AK)' }),
  rf('AR', 'Bonused sales - Low', 'FORECAST', 'Calculated', 'cur0', 'Forecast bonused sales, low case.', { words: 'Avg spend Low x bonused members Low.', excel: '=AJ*AN' }),
  rf('AS', 'Bonused Sales - High', 'FORECAST', 'Calculated', 'cur0', 'Forecast bonused sales, high case.', { words: 'Avg spend High x bonused members High.', excel: '=AK*AO' }),
  rf('AT', 'Bonused sales - Average', 'FORECAST', 'Calculated', 'cur0', 'Average forecast bonused sales.', { words: 'Average of AR and AS.', excel: '=AVERAGE(AR,AS)' }),
  rf('AU', 'Base points - low', 'FORECAST', 'Calculated', 'num0', 'Base points on low sales.', { words: 'Bonused sales Low x base points per $.', excel: '=AR*X' }),
  rf('AV', 'Base points - high', 'FORECAST', 'Calculated', 'num0', 'Base points on high sales.', { words: 'Bonused sales High x base points per $.', excel: '=AS*X' }),
  rf('AW', 'Base points average', 'FORECAST', 'Calculated', 'num0', 'Average base points.', { words: 'Average of AU and AV.', excel: '=AVERAGE(AU,AV)' }),
  rf('AX', 'Bonus points - low', 'FORECAST', 'Calculated', 'num0', 'Forecast bonus points, low case.', {
    words: '0 when Cancelled. Multiplier: base points Low x W; otherwise bonused members Low x W; 0 if that fails.',
    excel: '=IF(C="CANCELLED",0,IFERROR(IF(L="Multiplier",AU*W,AN*W),0))',
  }),
  rf('AY', 'Bonus points - high', 'FORECAST', 'Calculated', 'num0', 'Forecast bonus points, high case.', {
    words: '0 when Cancelled. Multiplier: base points High x W; otherwise bonused members High x W; 0 if that fails.',
    excel: '=IF(C="CANCELLED",0,IFERROR(IF(L="Multiplier",AV*W,AO*W),0))',
  }),
  rf('AZ', 'Bonus points average', 'FORECAST', 'Calculated', 'num0', 'Average forecast bonus points.', { words: 'Average of AX and AY.', excel: '=AVERAGE(AX,AY)' }),
  rf('BA', 'Base points redeemable $ (100%) - Low', 'FORECAST', 'Calculated', 'cur0', 'Dollar value of low base points.', { words: 'Base points Low / 1,000 x $ per 1,000 points.', excel: '=AU/1000*V' }),
  rf('BB', 'Base points redeemable $ (100%) - High', 'FORECAST', 'Calculated', 'cur0', 'Dollar value of high base points.', { words: 'Base points High / 1,000 x $ per 1,000 points.', excel: '=AV/1000*V' }),
  rf('BC', 'Bonus points redeemable $ (100%) - Low', 'FORECAST', 'Calculated', 'cur0', 'Dollar value of low bonus points.', { words: 'Bonus points Low / 1,000 x $ per 1,000 points.', excel: '=AX/1000*V' }),
  rf('BD', 'Bonus points redeemable $ (100%) - High', 'FORECAST', 'Calculated', 'cur0', 'Dollar value of high bonus points.', { words: 'Bonus points High / 1,000 x $ per 1,000 points.', excel: '=AY/1000*V' }),
  rf('BE', 'Bonus points redeemable $ (100%) - Average', 'FORECAST', 'Calculated', 'cur0', 'Average dollar value of bonus points.', { words: 'Average of BC and BD.', excel: '=AVERAGE(BC,BD)' }),
  rf('BF', 'Forcast - Assumed Redemption Rate', 'FORECAST', 'Calculated', 'pct0', 'Share of forecast points expected to be redeemed.', {
    words: 'Same rule as AC.',
    excel: '=IF(L="Points donations",1,IF(L="Extra Entries",1,IF(L="Limited Time Bonus Offer",1,IF(D>=DATE(2025,10,1),0.88,0.85))))',
    caveat: 'Excel spells the header "Forcast"; kept as is.',
  }),
  rf('BG', 'Bonus points redeemable $ (w/ breakage if applicable) - Low', 'FORECAST', 'Calculated', 'cur0', 'Low bonus points dollars after breakage.', { words: 'BC x BF.', excel: '=BC*BF' }),
  rf('BH', 'Bonus points redeemable $ (w/ breakage if applicable) - High', 'FORECAST', 'Calculated', 'cur0', 'High bonus points dollars after breakage.', { words: 'BD x BF.', excel: '=BD*BF' }),
  rf('BI', 'Bonus points redeemable $ (breakage if applicable) - Average', 'FORECAST', 'Calculated', 'cur0', 'Average bonus points dollars after breakage ($MDs with breakage).', { words: 'Average of BG and BH.', excel: '=AVERAGE(BG,BH)' }),
  rf('BJ', 'JBP - FCST: Base + Bonus points redeemable $ (no breakage) - low', 'FORECAST', 'Calculated', 'cur0', 'Low base + bonus points dollars, no breakage.', { words: 'BA + BC.', excel: '=BA+BC' }),
  rf('BK', 'JBP - FCST: Base + Bonus points redeemable $ (no breakage) - high', 'FORECAST', 'Calculated', 'cur0', 'High base + bonus points dollars, no breakage.', { words: 'BB + BD.', excel: '=BB+BD' }),
  rf('BL', 'JBP - FCST: Base + Bonus points redeemable $ (no breakage) - Avg', 'FORECAST', 'Calculated', 'cur0', 'Average base + bonus points dollars, no breakage.', { words: 'Average of BJ and BK.', excel: '=AVERAGE(BJ,BK)' }),

  rf('BM', 'Offer Period', 'WBR', 'Calculated', 'text', 'Offer dates as m/d-m/d.', { words: 'Start and End as month/day, joined with a dash.', excel: '=TEXT(D,"m/d")&"-"&TEXT(E,"m/d")' }),
  rf('BN', 'FORECAST - activations (thousands)', 'WBR', 'Calculated', 'text', 'Average forecast activations in thousands.', { words: 'Activation average / 1,000 rounded down to 1 decimal, then "K".', excel: '=IF(AL="null","",IFERROR(ROUNDDOWN(AL/1000,1),0)&"K")' }),
  rf('BO', 'FORECAST - bonused member & rate', 'WBR', 'Calculated', 'text', 'Forecast bonused members with the average rate.', {
    words: 'Bonused members average (in K from 1,000) with the bonus rate average in brackets.',
    excel: '=IF(AM="null","",IFERROR(IF(AP<1000,ROUND(AP,0),ROUND(AP/1000,0)&"K")&" ("&IF(AM=0,"0%",IF(AM>=0.1,TEXT(AM,"0%"),TEXT(AM,"0.0%")))&")",""))',
  }),
  rf('BP', 'FORECAST - spend per bonused member', 'WBR', 'Calculated', 'text', 'Forecast spend per transaction.', { words: '"$" and the rounded average spend; "N/A" when 0.', excel: '=IF(AQ=0,"N/A",IFERROR("$"&ROUND(AQ,0),"N/A"))' }),
  rf('BQ', 'FORECAST bonus pts (MDs)', 'WBR', 'Calculated', 'text', 'Forecast bonus points with the $MDs after breakage.', {
    words: 'Bonus points average in B / M / K, with the breakage dollars in brackets.',
    excel: '=IF(AZ=0,"N/A",IFERROR(IF(AZ>=1E9,ROUND(AZ/1E9,1)&"B",IF(AZ>=1E6,ROUND(AZ/1E6,0)&"M",ROUND(AZ/1000,0)&"K"))&" ($"&IF(BI>=1E6,ROUND(BI/1E6,1)&"M",IF(BI>=1000,ROUND(BI/1000,0)&"K",ROUND(BI,0)))&")","N/A"))',
  }),
  rf('BR', 'ACTUALS - activations', 'WBR', 'Calculated', 'text', 'Actual activations in M / K.', { words: 'Activations in M (2 decimals) from 1 million, K from 1,000.', excel: '=IFERROR(IF(P>=1E6,ROUND(P/1E6,2)&"M",IF(P>=1000,ROUND(P/1000,0)&"K",ROUND(P,0))),"TBD")' }),
  rf('BS', 'ACTUALS - bonused member & rate', 'WBR', 'Calculated', 'text', 'Actual bonused members with the bonus rate.', {
    words: 'Bonused members (in K from 1,000) with the bonus rate: 1 decimal up to 9.5%, whole number above.',
    excel: '=IFERROR(IF(Q="N/A","",IF(Q<1000,Q,ROUND(Q/1000,0)&"K")&" ("&IF(U*100<=9.5,TEXT(ROUND(U*100,1),"0.0"),ROUND(U*100,0))&"%)"),"N/A")',
  }),
  rf('BT', 'ACTUALS - spend per bonused member', 'WBR', 'Calculated', 'text', 'Actual spend per bonused member.', { words: '"$" and the rounded AE; "TBD" when AE is TBD.', excel: '=IF(AE="TBD","TBD","$"&ROUND(AE,0))' }),
  rf('BU', 'ACTUALS bonus pts (MDs)', 'WBR', 'Calculated', 'text', 'Actual bonus points with the breakage dollars.', {
    words: 'Points issued in B / M / K with AD in brackets (M with 0 decimals here).',
    excel: '=IFERROR(IF(R="N/A","N/A",IF(R>=1E9,ROUND(R/1E9,1)&"B",IF(R>=1E6,ROUND(R/1E6,0)&"M",ROUND(R/1000,0)&"K"))&" ($"&IF(AD>=1E6,ROUND(AD/1E6,0)&"M",IF(AD>=1000,ROUND(AD/1000,0)&"K",ROUND(AD,0)))&")"),"N/A")',
  }),
  rf('BV', 'ACTUALS bonused sales', 'WBR', 'Calculated', 'text', 'Actual bonused sales in $, $K or $M.', {
    words: 'Bonused sales as $n, $nK below 500,000, $n.nM above. "TBD" when sales are TBD.',
    excel: '=IFERROR(IF(Y="","N/A",IF(Y="N/A","N/A",IF(Y<1000,"$"&ROUND(Y,0),IF(Y<500000,"$"&ROUND(Y/1000,0)&"K","$"&ROUND(Y/1E6,1)&"M")))),"TBD")',
  }),
  rf('BW', 'Prorated results', 'WBR', 'Calculated', 'int', 'Days run so far at the as-of date.', { words: 'Blank before the start; else days since start, capped at Promo Days.', excel: '=IF(asOf<D,"",IFERROR(MIN(asOf-D,F),""))' }),
  rf('BX', '% completed by days', 'WBR', 'Calculated', 'pct0', 'Share of the offer run so far.', { words: 'BW divided by Promo Days.', excel: '=IFERROR(BW/F,"")' }),
  rf('BY', 'Prorated pts issued', 'WBR', 'Calculated', 'num0', 'Points issued scaled to the full offer.', { words: 'Points issued divided by % completed.', excel: '=IFERROR(R/BX,"")' }),
  rf('BZ', 'Color code', 'WBR', 'Calculated', 'text', 'Pace against the forecast.', {
    words: 'Pink below the forecast Low, Dark Green above the forecast High, else Light green. Shows as soon as the offer has started.',
    excel: '=IFERROR(IF(OR(BY="",BQ=""),"",IF(BY<AX,"Pink",IF(BY>AY,"Dark Green","Light green"))),"")',
  }),
];

const cal = (
  letter: string,
  header: string,
  tag: RegistryTag,
  format: Fmt,
  meaning: string,
  extra: Partial<RegistryEntry> = {},
): RegistryEntry => ({
  key: `cal:${letter}`,
  source: 'Calendar main tab',
  letter,
  header,
  tab: 'grid',
  band: 'CALENDAR',
  tag,
  format,
  meaning,
  ...extra,
});

/** Calendar main tab: the 18 forecast / results columns shown in the CALENDAR band. */
export const CALENDAR_BAND: RegistryEntry[] = [
  cal('DH', 'Fcst Date', 'Typed', 'date', 'Date the forecast was created.', { fieldId: 'forecastDate', inputSource: 'Source: Step 7, Fcst Date' }),
  cal('DI', 'Forecast Created by', 'Typed', 'text', 'Who created the forecast.', { fieldId: 'forecastCreatedBy', inputSource: 'Source: Step 7, Forecast Created by' }),
  cal('DZ', 'Forecast Notes', 'Dropdown', 'text', 'Forecast status / notes.', { fieldId: 'forecastStatus', inputSource: 'Source: Step 7, Forecast Status / Notes' }),
  cal('DY', 'Forecast needed?', 'Calculated', 'text', 'Whether the offer still needs a forecast.', {
    fieldId: 'forecastNeeded',
    words: 'No for Activation Only - Internal Reward. Yes for MERCH, SERVICES, LOYALTY, DIGITAL, REDEMPTION or BENEFIT/BIRTHDAY when the low redeemable $ is 0 and the offer is not Cancelled.',
  }),
  cal('DJ', 'Total offer days including pre-activation', 'Calculated', 'int', 'Days from early activation (or start) to end.', { fieldId: 'totalOfferDays', words: 'End - Start + 1, or End - Early Activation Date + 1.' }),
  cal('DK', 'Activation by day - Low', 'Typed', 'num2opt', 'Forecast activations per day, low case.', { fieldId: 'activationByDayLow', inputSource: 'Source: Step 7, Activation by day - Low' }),
  cal('DL', 'Activation by day - High', 'Typed', 'num2opt', 'Forecast activations per day, high case.', { fieldId: 'activationByDayHigh', inputSource: 'Source: Step 7, Activation by day - High' }),
  cal('DS', 'Bonused members - Low', 'Copy of R&F', 'num0', 'Pulled back from Results & Forecast column AN.', { fieldId: 'bonusedMembersLow', twinOf: 'rf:AN' }),
  cal('DT', 'Bonused members - High', 'Copy of R&F', 'num0', 'Pulled back from Results & Forecast column AO.', { fieldId: 'bonusedMembersHigh', twinOf: 'rf:AO' }),
  cal('DU', 'Bonused sales - Low', 'Copy of R&F', 'cur0', 'Pulled back from Results & Forecast column AR.', { fieldId: 'bonusedSalesLow', twinOf: 'rf:AR' }),
  cal('DV', 'Bonused Sales - High', 'Copy of R&F', 'cur0', 'Pulled back from Results & Forecast column AS.', { fieldId: 'bonusedSalesHigh', twinOf: 'rf:AS' }),
  cal('DW', 'Bonus points redeemable $ (w/ breakage if applicable) - Low', 'Copy of R&F', 'cur0', 'Pulled back from Results & Forecast column BG.', { fieldId: 'bonusRedeemableLow', twinOf: 'rf:BG' }),
  cal('DX', 'Bonus points redeemable $ (w/ breakage if applicable) - High', 'Copy of R&F', 'cur0', 'Pulled back from Results & Forecast column BH.', { fieldId: 'bonusRedeemableHigh', twinOf: 'rf:BH' }),
  cal('DC', 'Results Date Updated', 'Typed', 'text', 'When the results were last updated.', { fieldId: 'resultsDateUpdated', inputSource: 'Source: Step 9, Results Date Updated' }),
  cal('CS', 'LOPD Actuals', 'Typed', 'text', 'LOPD actuals.', { fieldId: 'lopdActuals', inputSource: 'Source: Step 9, LOPD Actuals' }),
  cal('CW', 'Include for Results and Forecast?', 'Calculated', 'text', 'Whether the offer appears in Results & Forecast.', {
    fieldId: 'includeForResultsForecast',
    words: 'Blank when the status is blank; No when Cancelled or Offer Design is IMP only; otherwise Yes.',
  }),
  cal('CX', 'Reference Results and Forecast? (retired)', 'Typed', 'int', 'The Excel ref number for the R&F row. Display only.', {
    caveat: 'Retired. The Offer ID replaces it.',
    hiddenByDefault: true,
  }),
  cal('CV', 'Reference number for Metadata file (retired)', 'Typed', 'int', 'The Excel ref number in the Metadata file. Display only.', {
    caveat: 'Retired. The Offer ID replaces it.',
    hiddenByDefault: true,
  }),
];

/** Calendar main tab columns shown through their R&F twin (not a separate grid column). */
export const CALENDAR_TWINS: RegistryEntry[] = [
  ['CP', 'Dashboard Mo. (reporting)', 'rf:B'],
  ['DD', 'Audience Size', 'rf:O'],
  ['DE', 'Activations', 'rf:P'],
  ['DF', 'Bonused members', 'rf:Q'],
  ['DG', 'Bonus Pts Issued', 'rf:R'],
  ['DM', 'Activation - Low', 'rf:AF'],
  ['DN', 'Activation - High', 'rf:AG'],
  ['DO', 'Bonus rate - Low', 'rf:AH'],
  ['DP', 'Bonus rate - High', 'rf:AI'],
  ['DQ', 'Avg Spend/txn - Low', 'rf:AJ'],
  ['DR', 'Avg spend/txn - High', 'rf:AK'],
].map(([letter, header, twin]) => ({
  key: `cal:${letter}`,
  source: 'Calendar main tab' as const,
  letter,
  header,
  tab: 'grid' as const,
  band: RF_REGISTRY.find((e) => e.key === twin)!.band,
  tag: RF_REGISTRY.find((e) => e.key === twin)!.tag,
  format: RF_REGISTRY.find((e) => e.key === twin)!.format,
  meaning: `Shown through its R&F twin (${twin.slice(3)}).`,
  twinOf: twin,
}));

export const REGISTRY: RegistryEntry[] = [...RF_REGISTRY, ...CALENDAR_BAND, ...CALENDAR_TWINS];

export function registryFor(tab: RegistryTab): RegistryEntry[] {
  return REGISTRY.filter((e) => e.tab === tab);
}
export const RF_BY_LETTER: Record<string, RegistryEntry> = Object.fromEntries(RF_REGISTRY.map((e) => [e.letter, e]));
