import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, timeout} from 'rxjs';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';
import {I18nService} from '../i18n/i18n.service';
import {MessageKey} from '../i18n/messages.en';

/** the three things the assets page keeps, each with its own form fields and address */
export type AssetType = 'realEstate' | 'other' | 'debt';
export const ASSET_TYPES: readonly AssetType[] = ['realEstate', 'other', 'debt'];

/** what another asset is: car, gold, cash or an account in another currency, money lent, anything else */
export type OtherKind = 'VEHICLE' | 'GOLD' | 'CASH' | 'RECEIVABLE' | 'OTHER';
export const OTHER_KINDS: readonly OtherKind[] = ['VEHICLE', 'GOLD', 'CASH', 'RECEIVABLE', 'OTHER'];

export interface RealEstate {
  id: number;
  name: string;
  address: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentEstimatedValue: number | null;
  monthlyRent: number | null;
  monthlyExpenses: number | null;
  /** none written (old rows): euro */
  currency: string | null;
}

export interface OtherAsset {
  id: number;
  name: string;
  kind: OtherKind;
  value: number;
  currency: string;
  /** the day of the estimate: in the net worth from then on; null = on every day */
  valuedOn: string | null;
}

/**
 * How a debt ends: the end date given, an estimate from payment and rate, never (the payment does not cover the
 * interest), unknown (no date, no payment), paid. `monthsLeft` is rounded up, negative when the end date has passed.
 */
export interface Payoff {
  kind: 'END_DATE' | 'ESTIMATE' | 'NEVER' | 'UNKNOWN' | 'PAID';
  expectedEnd: string | null;
  monthsLeft: number | null;
}

export interface Debt {
  id: number;
  name: string;
  balance: number;
  currency: string;
  /** yearly, in percent (5.9 = 5.9%) */
  annualRate: number | null;
  monthlyPayment: number | null;
  endDate: string | null;
  payoff: Payoff;
}

/** what counts today in one currency; debts are negative; net = the three together */
export interface AssetsTotal {
  currency: string;
  realEstate: number;
  otherAssets: number;
  debts: number;
  net: number;
}

/** GET /api/assets: everything, largest first; `totals`: euro first (always there), then the other currencies */
export interface AssetsAnswer {
  currency: string;
  today: string;
  realEstates: RealEstate[];
  otherAssets: OtherAsset[];
  debts: Debt[];
  totals: AssetsTotal[];
}

/**
 * What the form edits: the fields of the three types together (only those of the chosen type are sent). Amounts are
 * numbers from number inputs (null = empty), dates ISO strings ('' = empty).
 */
export interface AssetDraft {
  name: string;
  currency: string;
  // real estate
  address: string;
  purchaseDate: string;
  purchasePrice: number | null;
  value: number | null;
  monthlyRent: number | null;
  monthlyExpenses: number | null;
  // other asset (value above)
  kind: OtherKind;
  valuedOn: string;
  // debt
  balance: number | null;
  annualRate: number | null;
  monthlyPayment: number | null;
  endDate: string;
}

export type DraftField = keyof AssetDraft;
export type DraftErrors = Partial<Record<DraftField, MessageKey>>;

export const MAX_NAME = 200;
export const MAX_TEXT = 300;
const MAX_AMOUNT = 1_000_000_000_000;

export function emptyDraft(): AssetDraft {
  return {name: '', currency: 'EUR', address: '', purchaseDate: '', purchasePrice: null, value: null, monthlyRent: null,
    monthlyExpenses: null, kind: 'VEHICLE', valuedOn: '', balance: null, annualRate: null, monthlyPayment: null,
    endDate: ''};
}

export function draftOf(type: AssetType, item: RealEstate | OtherAsset | Debt): AssetDraft {
  const d = emptyDraft();
  d.name = item.name ?? '';
  d.currency = (item as {currency: string | null}).currency || 'EUR';
  if (type === 'realEstate') {
    const r = item as RealEstate;
    Object.assign(d, {address: r.address ?? '', purchaseDate: r.purchaseDate ?? '', purchasePrice: r.purchasePrice,
      value: r.currentEstimatedValue, monthlyRent: r.monthlyRent, monthlyExpenses: r.monthlyExpenses});
  } else if (type === 'other') {
    const o = item as OtherAsset;
    Object.assign(d, {kind: o.kind, value: o.value, valuedOn: o.valuedOn ?? ''});
  } else {
    const debt = item as Debt;
    Object.assign(d, {balance: debt.balance, annualRate: debt.annualRate, monthlyPayment: debt.monthlyPayment,
      endDate: debt.endDate ?? ''});
  }
  return d;
}

function isEmpty(v: number | null | undefined | string): boolean {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
}

function decimals(v: number): number {
  const text = String(v);
  if (text.includes('e-')) {
    return Number(text.split('e-')[1]);
  }
  return text.includes('.') ? text.split('.')[1].length : 0;
}

function amountError(v: number | null, required: boolean): MessageKey | undefined {
  if (isEmpty(v)) {
    return required ? 'assets.error.required' : undefined;
  }
  const n = Number(v);
  if (n < 0) {
    return 'assets.error.negative';
  }
  if (n > MAX_AMOUNT || decimals(n) > 2) {
    return 'assets.error.amount';
  }
  return undefined;
}

function dateError(v: string, today: string, notAfterToday: boolean): MessageKey | undefined {
  if (!v) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-01') {
    return 'assets.error.date';
  }
  if (notAfterToday && v > today) {
    return 'assets.error.future';
  }
  const limit = String(Number(today.substring(0, 4)) + 100) + today.substring(4);
  return v > limit ? 'assets.error.date' : undefined;
}

/** the same rules as the server, field by field, so every error is written next to its field before saving */
export function validate(type: AssetType, d: AssetDraft, today: string): DraftErrors {
  const errors: DraftErrors = {};
  const set = (field: DraftField, key: MessageKey | undefined) => {
    if (key) {
      errors[field] = key;
    }
  };
  const name = d.name.trim();
  set('name', !name ? 'assets.error.name' : name.length > MAX_NAME ? 'assets.error.nameLong' : undefined);
  set('currency', /^[A-Za-z]{3}$/.test(d.currency.trim()) ? undefined : 'assets.error.currency');
  if (type === 'realEstate') {
    set('address', d.address.trim().length > MAX_TEXT ? 'assets.error.textLong' : undefined);
    set('value', amountError(d.value, true));
    set('purchasePrice', amountError(d.purchasePrice, false));
    set('monthlyRent', amountError(d.monthlyRent, false));
    set('monthlyExpenses', amountError(d.monthlyExpenses, false));
    set('purchaseDate', dateError(d.purchaseDate, today, false));
  } else if (type === 'other') {
    set('kind', OTHER_KINDS.includes(d.kind) ? undefined : 'assets.error.kind');
    set('value', amountError(d.value, true));
    set('valuedOn', dateError(d.valuedOn, today, true));
  } else {
    set('balance', amountError(d.balance, true));
    set('monthlyPayment', amountError(d.monthlyPayment, false));
    if (!isEmpty(d.annualRate)) {
      const rate = Number(d.annualRate);
      set('annualRate', rate < 0 || rate > 100 || decimals(rate) > 3 ? 'assets.error.rate' : undefined);
    }
    set('endDate', dateError(d.endDate, today, false));
  }
  return errors;
}

/** the server's codes, next to the field they are about (null: said under the form) */
export const SERVER_ERRORS: Record<string, { key: MessageKey; field: DraftField | null }> = {
  NAME_REQUIRED: {key: 'assets.error.name', field: 'name'},
  NAME_TOO_LONG: {key: 'assets.error.nameLong', field: 'name'},
  TEXT_TOO_LONG: {key: 'assets.error.textLong', field: 'address'},
  CURRENCY: {key: 'assets.error.currency', field: 'currency'},
  KIND: {key: 'assets.error.kind', field: 'kind'},
  RATE_RANGE: {key: 'assets.error.rate', field: 'annualRate'},
  DATE_IN_FUTURE: {key: 'assets.error.future', field: 'valuedOn'},
  AMOUNT_REQUIRED: {key: 'assets.error.amounts', field: null},
  AMOUNT_RANGE: {key: 'assets.error.amounts', field: null},
  DATE_RANGE: {key: 'assets.error.dates', field: null},
  TOO_MANY: {key: 'assets.error.tooMany', field: null}
};

function num(v: number | null): number | null {
  return isEmpty(v) ? null : Number(v);
}

/** the body the server takes for the type */
export function requestOf(type: AssetType, d: AssetDraft): Record<string, unknown> {
  const common = {name: d.name.trim(), currency: d.currency.trim().toUpperCase()};
  if (type === 'realEstate') {
    return {...common, address: d.address.trim() || null, purchaseDate: d.purchaseDate || null,
      purchasePrice: num(d.purchasePrice), currentEstimatedValue: num(d.value), monthlyRent: num(d.monthlyRent),
      monthlyExpenses: num(d.monthlyExpenses)};
  }
  if (type === 'other') {
    return {...common, kind: d.kind, value: num(d.value), valuedOn: d.valuedOn || null};
  }
  return {...common, balance: num(d.balance), annualRate: num(d.annualRate), monthlyPayment: num(d.monthlyPayment),
    endDate: d.endDate || null};
}

const URLS: Record<AssetType, string> = {
  realEstate: '/api/realestate',
  other: '/api/assets/others',
  debt: '/api/assets/debts'
};

@Injectable({providedIn: 'root'})
export class AssetsService {
  private http = inject(HttpClient);

  summary(): Observable<AssetsAnswer> {
    return this.http.get<AssetsAnswer>('/api/assets').pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** a new one (id null) or a change */
  save(type: AssetType, id: number | null, draft: AssetDraft): Observable<unknown> {
    const body = requestOf(type, draft);
    return (id === null ? this.http.post(URLS[type], body) : this.http.put(`${URLS[type]}/${id}`, body))
      .pipe(timeout(CALL_TIMEOUT_MS));
  }

  remove(type: AssetType, id: number): Observable<unknown> {
    return this.http.delete(`${URLS[type]}/${id}`).pipe(timeout(CALL_TIMEOUT_MS));
  }
}

/** "2 years and 4 months", "5 months", "1 year" */
export function duration(i18n: I18nService, months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(years === 1 ? i18n.t('assets.year') : i18n.t('assets.years', {count: years}));
  }
  if (rest > 0) {
    parts.push(rest === 1 ? i18n.t('assets.month') : i18n.t('assets.months', {count: rest}));
  }
  return parts.join(i18n.t('assets.and'));
}

/** how a debt ends, in words, and whether it needs a look (an end date that has passed, a payment that never ends it) */
export function payoffText(i18n: I18nService, payoff: Payoff): { text: string; warn: boolean } {
  const month = i18n.month(payoff.expectedEnd);
  const left = payoff.monthsLeft ?? 0;
  switch (payoff.kind) {
    case 'PAID':
      return {text: i18n.t('assets.payoff.paid'), warn: false};
    case 'END_DATE':
      if (left < 0) {
        return {text: i18n.t('assets.payoff.past', {month}), warn: true};
      }
      return {text: left === 0 ? i18n.t('assets.payoff.thisMonth', {month})
          : i18n.t('assets.payoff.end', {month, duration: duration(i18n, left)}), warn: false};
    case 'ESTIMATE':
      return {text: i18n.t('assets.payoff.estimate', {month, duration: duration(i18n, left)}), warn: false};
    case 'NEVER':
      return {text: i18n.t('assets.payoff.never'), warn: true};
    default:
      return {text: i18n.t('assets.payoff.unknown'), warn: false};
  }
}
