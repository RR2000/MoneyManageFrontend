import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, timeout} from 'rxjs';
import {CALL_TIMEOUT_MS} from '../accounts/accounts.service';
import {MessageKey} from '../i18n/messages.en';

export type EventKind = 'ONE_OFF' | 'MONTHLY';
export type ScenarioKey = 'PRUDENT' | 'BASE' | 'OPTIMISTIC';
export type TrackStatus = 'WAITING' | 'ON_TRACK' | 'ABOVE' | 'BELOW';

/** ONE_OFF: money in (+) or out (−) once; MONTHLY: the monthly payment changes by the amount from that month on */
export interface PlanEvent {
  kind: EventKind;
  date: string;
  amount: number;
  label: string | null;
}

/** What a plan says. Rates in percent a year. `*Own` false: on saving, money's value of that day is taken. */
export interface PlanConfig {
  targetDate: string;
  startValue: number;
  startValueOwn: boolean;
  invested: number;
  investedOwn: boolean;
  monthly: number;
  monthlyOwn: boolean;
  inflation: number;
  taxRate: number;
  ratePrudent: number;
  rateBase: number;
  rateOptimistic: number;
  events: PlanEvent[];
}

/** what money says today: value, money put in (cost of what is held), net purchases a month, XIRR in percent */
export interface MoneyInputs {
  date: string;
  currency: string;
  value: number;
  invested: number;
  monthly: number;
  monthlyMonths: number;
  historicalRate: number | null;
  since: string | null;
}

export interface Scenario {
  key: ScenarioKey;
  rate: number;
  gross: number;
  invested: number;
  tax: number;
  afterTax: number;
  real: number;
}

export interface MonteCarlo {
  available: boolean;
  reason: string | null;
  historyMonths: number;
  yearlyMean: number | null;
  yearlyVolatility: number | null;
  simulations: number;
  p5: number[] | null;
  p50: number[] | null;
  p95: number[] | null;
}

/** month by month from this month (index 0) to the target month */
export interface Projection {
  from: string;
  targetDate: string;
  months: number;
  years: number;
  currency: string;
  scenarios: Scenario[];
  labels: string[];
  prudent: number[];
  base: number[];
  optimistic: number[];
  invested: number[];
  monteCarlo: MonteCarlo | null;
}

export interface TrackPoint {
  month: string;
  planned: number;
  actual: number | null;
}

export interface Tracking {
  version: number;
  savedOn: string;
  status: TrackStatus;
  month: string | null;
  planned: number | null;
  actual: number | null;
  gap: number | null;
  gapShare: number | null;
  nextCheck: string;
  points: TrackPoint[];
}

export interface VersionView {
  number: number;
  savedAt: string;
  savedOn: string;
  config: PlanConfig;
  moneyValue: number;
  historicalRate: number | null;
}

export interface VersionSummary {
  number: number;
  savedAt: string;
  savedOn: string;
  targetDate: string;
  monthly: number;
  monthlyOwn: boolean;
  rateBase: number;
  events: number;
}

/** GET /api/plans/{id}: one version of a plan (`latest`: the one in use); projection null when the target has passed */
export interface PlanView {
  id: number;
  name: string;
  version: VersionView;
  latest: boolean;
  versions: VersionSummary[];
  money: MoneyInputs;
  projection: Projection | null;
  tracking: Tracking;
}

export interface PlanSummary {
  id: number;
  name: string;
  versions: number;
  savedAt: string;
  targetDate: string;
  tracking: Tracking;
}

/** GET /api/plans: the one saved last first */
export interface PlansOverview {
  money: MoneyInputs;
  plans: PlanSummary[];
}

/** the form: numbers as the number inputs give them (null when empty or not a number) */
export interface EventDraft {
  kind: EventKind;
  date: string;
  amount: number | null;
  label: string;
}

export interface PlanDraft {
  name: string;
  targetDate: string;
  startValue: number | null;
  startValueOwn: boolean;
  invested: number | null;
  investedOwn: boolean;
  monthly: number | null;
  monthlyOwn: boolean;
  inflation: number | null;
  taxRate: number | null;
  ratePrudent: number | null;
  rateBase: number | null;
  rateOptimistic: number | null;
  events: EventDraft[];
}

export type PlanField = 'name' | 'targetDate' | 'startValue' | 'invested' | 'monthly' | 'inflation' | 'taxRate'
  | 'ratePrudent' | 'rateBase' | 'rateOptimistic' | 'rates' | 'events';

export interface EventErrors {
  date?: MessageKey;
  amount?: MessageKey;
  label?: MessageKey;
}

export interface DraftErrors {
  fields: Partial<Record<PlanField, MessageKey>>;
  events: EventErrors[];
}

export const MAX_NAME = 60;
export const MAX_LABEL = 60;
export const MAX_EVENTS = 50;
const MAX_AMOUNT = 1e12;
const MAX_MONTHLY = 1e9;

export const DEFAULTS = {ratePrudent: 3, rateBase: 5, rateOptimistic: 7, inflation: 2, taxRate: 26};

/** the server's codes, next to the field they are about (null: said under the form) */
export const SERVER_ERRORS: Record<string, { key: MessageKey; field: PlanField | null }> = {
  NAME_REQUIRED: {key: 'plan.error.name', field: 'name'},
  NAME_TOO_LONG: {key: 'plan.error.nameLong', field: 'name'},
  TARGET_DATE: {key: 'plan.error.target', field: 'targetDate'},
  START_RANGE: {key: 'plan.error.amount', field: 'startValue'},
  INVESTED_RANGE: {key: 'plan.error.amount', field: 'invested'},
  MONTHLY_RANGE: {key: 'plan.error.amount', field: 'monthly'},
  RATE_RANGE: {key: 'plan.error.rate', field: 'rates'},
  RATE_ORDER: {key: 'plan.error.rateOrder', field: 'rates'},
  INFLATION_RANGE: {key: 'plan.error.inflation', field: 'inflation'},
  TAX_RANGE: {key: 'plan.error.tax', field: 'taxRate'},
  TOO_MANY_EVENTS: {key: 'plan.error.tooManyEvents', field: 'events'},
  EVENT_KIND: {key: 'plan.error.events', field: 'events'},
  EVENT_DATE: {key: 'plan.error.events', field: 'events'},
  EVENT_AMOUNT: {key: 'plan.error.events', field: 'events'},
  EVENT_LABEL: {key: 'plan.error.events', field: 'events'},
  TOO_MANY: {key: 'plan.error.tooMany', field: null},
  TOO_MANY_VERSIONS: {key: 'plan.error.tooManyVersions', field: null}
};

/** yyyy-MM-dd of a local day */
export function isoDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** months from the month of `from` to the month of `to` (yyyy-MM-dd), like the server */
export function monthIndex(from: string, to: string): number {
  const y = (s: string) => Number(s.substring(0, 4));
  const m = (s: string) => Number(s.substring(5, 7));
  return (y(to) - y(from)) * 12 + m(to) - m(from);
}

function decimals(n: number): number {
  const s = String(n);
  if (s.includes('e-')) {
    return Number(s.split('e-')[1]);
  }
  return s.includes('.') ? s.split('.')[1].length : 0;
}

function empty(v: number | null | undefined): boolean {
  return v === null || v === undefined || (typeof v === 'number' && isNaN(v));
}

function amountError(v: number | null, max: number): MessageKey | undefined {
  return empty(v) || v! < 0 || v! > max || decimals(v!) > 2 ? 'plan.error.amount' : undefined;
}

function percentError(v: number | null, min: number, max: number, key: MessageKey): MessageKey | undefined {
  return empty(v) || v! < min || v! > max || decimals(v!) > 2 ? key : undefined;
}

/** the same rules as the server, so every error is written next to its field before anything is sent */
export function validate(d: PlanDraft, today: string): DraftErrors {
  const fields: Partial<Record<PlanField, MessageKey>> = {};
  const set = (field: PlanField, key: MessageKey | undefined) => {
    if (key) {
      fields[field] = key;
    }
  };
  const name = d.name.trim().replace(/\s+/g, ' ');
  set('name', !name ? 'plan.error.name' : name.length > MAX_NAME ? 'plan.error.nameLong' : undefined);
  const months = /^\d{4}-\d{2}-\d{2}$/.test(d.targetDate) ? monthIndex(today, d.targetDate) : -1;
  const limit = String(Number(today.substring(0, 4)) + 100) + today.substring(4);
  set('targetDate', months < 1 || d.targetDate > limit ? 'plan.error.target' : undefined);
  set('startValue', amountError(d.startValue, MAX_AMOUNT));
  set('invested', amountError(d.invested, MAX_AMOUNT));
  set('monthly', amountError(d.monthly, MAX_MONTHLY));
  set('ratePrudent', percentError(d.ratePrudent, -20, 30, 'plan.error.rate'));
  set('rateBase', percentError(d.rateBase, -20, 30, 'plan.error.rate'));
  set('rateOptimistic', percentError(d.rateOptimistic, -20, 30, 'plan.error.rate'));
  if (!fields.ratePrudent && !fields.rateBase && !fields.rateOptimistic
    && (d.ratePrudent! > d.rateBase! || d.rateBase! > d.rateOptimistic!)) {
    fields.rates = 'plan.error.rateOrder';
  }
  set('inflation', percentError(d.inflation, -5, 20, 'plan.error.inflation'));
  set('taxRate', percentError(d.taxRate, 0, 100, 'plan.error.tax'));
  if (d.events.length > MAX_EVENTS) {
    fields.events = 'plan.error.tooManyEvents';
  }
  const events = d.events.map(e => {
    const errors: EventErrors = {};
    const k = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? monthIndex(today, e.date) : -1;
    if (k < 1 || (months >= 1 && k > months)) {
      errors.date = 'plan.error.eventDate';
    }
    const max = e.kind === 'MONTHLY' ? MAX_MONTHLY : MAX_AMOUNT;
    if (empty(e.amount) || e.amount === 0 || Math.abs(e.amount!) > max || decimals(e.amount!) > 2) {
      errors.amount = 'plan.error.eventAmount';
    }
    if (e.label.trim().replace(/\s+/g, ' ').length > MAX_LABEL) {
      errors.label = 'plan.error.nameLong';
    }
    return errors;
  });
  return {fields, events};
}

export function hasErrors(e: DraftErrors): boolean {
  return Object.keys(e.fields).length > 0 || e.events.some(x => Object.keys(x).length > 0);
}

/** the config the server takes (call only when `validate` found nothing) */
export function configOf(d: PlanDraft): PlanConfig {
  return {
    targetDate: d.targetDate,
    startValue: d.startValue!, startValueOwn: d.startValueOwn,
    invested: d.invested!, investedOwn: d.investedOwn,
    monthly: d.monthly!, monthlyOwn: d.monthlyOwn,
    inflation: d.inflation!, taxRate: d.taxRate!,
    ratePrudent: d.ratePrudent!, rateBase: d.rateBase!, rateOptimistic: d.rateOptimistic!,
    events: d.events.map(e => ({kind: e.kind, date: e.date, amount: e.amount!,
      label: e.label.trim().replace(/\s+/g, ' ') || null}))
  };
}

/** the form of a saved version; `money`: today's values for the inputs from money (the version in use) */
export function draftOf(name: string, c: PlanConfig, money: MoneyInputs | null): PlanDraft {
  return {
    name,
    targetDate: c.targetDate,
    startValue: !c.startValueOwn && money ? money.value : c.startValue,
    startValueOwn: c.startValueOwn,
    invested: !c.investedOwn && money ? money.invested : c.invested,
    investedOwn: c.investedOwn,
    monthly: !c.monthlyOwn && money ? money.monthly : c.monthly,
    monthlyOwn: c.monthlyOwn,
    inflation: c.inflation, taxRate: c.taxRate,
    ratePrudent: c.ratePrudent, rateBase: c.rateBase, rateOptimistic: c.rateOptimistic,
    events: c.events.map(e => ({kind: e.kind, date: e.date, amount: e.amount, label: e.label ?? ''}))
  };
}

/** a new plan from money's values: 20 years ahead (the end of that year), the default rates, no events */
export function newDraft(name: string, money: MoneyInputs, today: string): PlanDraft {
  return {
    name,
    targetDate: `${Number(today.substring(0, 4)) + 20}-12-31`,
    startValue: money.value, startValueOwn: false,
    invested: money.invested, investedOwn: false,
    monthly: money.monthly, monthlyOwn: false,
    ...DEFAULTS,
    events: []
  };
}

/** the same form, as a string, to tell whether something changed */
export function sameDraft(a: PlanDraft, b: PlanDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The rows of "See as a table": the start, then a step of 6 months (short plans), a year (up to 10 years) or a few
 * years, so there are about five rows; the target month always last.
 */
export function tableRows(months: number): number[] {
  if (months <= 0) {
    return [0];
  }
  const step = months <= 24 ? 6 : 12 * Math.ceil(months / 60);
  const rows: number[] = [];
  for (let k = 0; k < months; k += step) {
    rows.push(k);
  }
  rows.push(months);
  return rows;
}

@Injectable({providedIn: 'root'})
export class PlanService {
  private http = inject(HttpClient);

  overview(): Observable<PlansOverview> {
    return this.http.get<PlansOverview>('/api/plans').pipe(timeout(CALL_TIMEOUT_MS));
  }

  get(id: number, version: number | null = null): Observable<PlanView> {
    return this.http.get<PlanView>(`/api/plans/${id}`, version === null ? {} : {params: {version}})
      .pipe(timeout(CALL_TIMEOUT_MS));
  }

  create(name: string, config: PlanConfig): Observable<PlanView> {
    return this.http.post<PlanView>('/api/plans', {name, config}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** a new version */
  save(id: number, name: string, config: PlanConfig): Observable<PlanView> {
    return this.http.put<PlanView>(`/api/plans/${id}`, {name, config}).pipe(timeout(CALL_TIMEOUT_MS));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/plans/${id}`).pipe(timeout(CALL_TIMEOUT_MS));
  }

  /** the numbers of values not saved, from today; `monteCarlo`: also the band from the history */
  project(config: PlanConfig, monteCarlo: boolean): Observable<Projection> {
    return this.http.post<Projection>('/api/plans/projection', {config, monteCarlo}).pipe(timeout(CALL_TIMEOUT_MS));
  }
}
